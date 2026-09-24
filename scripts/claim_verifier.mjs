#!/usr/bin/env node
// claim_verifier.mjs — 어시스턴트 주장을 실제 도구 실행 기록과 대조한다.
//
// 입력: --transcript <session.jsonl> (필수) — tool_use/tool_result 레코드 포함
//       --guard-log <decisions.jsonl> (선택) — intent-guard 판정 로그
//       --claims <claims.json>       (선택) — 명시 주장 목록; 없으면 마지막
//                                       어시스턴트 텍스트에서 패턴 추출
// 출력: JSON {claims:[{text,kind,verdict,evidence}]}
//   verdict: corroborated(뒷받침) | contradicted(반증) | unsupported(근거 없음)
//   not_checkable은 주장으로 추출되지 않은 문장에만 해당 — 출력에 포함하지 않는다.
// 종료 코드: contradicted가 하나라도 있으면 1, 아니면 0.

import { readFileSync } from "node:fs";

// 추출 패턴 → 증거로 필요한 도구 실행 매처
const CLAIM_KINDS = [
  { kind: "tests-pass",
    claim: /(?:모든\s*)?테스트(가|를|에서)?\s*(통과|성공)|all tests? (?:pass|passed)|tests? (?:pass|passed)|\d+\s+tests? passed|통과했/i,
    tool: /test|pytest|vitest|jest|node --test|unittest|nose/i },
  { kind: "build-ok",
    claim: /빌드(가|를)?\s*(성공|완료|통과)|build (?:succeeded|passed|completed)|컴파일 (?:성공|완료)/i,
    tool: /build|tsc|compile|npm run|webpack|vite|esbuild/i },
  { kind: "lint-ok",
    claim: /린트(가|를)?\s*(통과|클린|성공)|lint(?:ing)? (?:passed|clean|ok)|no lint/i,
    tool: /lint|biome|eslint|flake8|ruff|pylint|check/i },
  { kind: "commit-made",
    claim: /커밋(을|를)?\s*(완료|했습니다|함)|committed|commit 완료/i,
    tool: /git\s+commit/i },
  { kind: "pushed",
    claim: /푸시(했|함|완료)|pushed|push 완료/i,
    tool: /git\s+push/i },
  { kind: "guard-blocked",
    claim: /차단(?:했|됨|하였)|blocked the command|guard(?:가)? 차단/i,
    tool: null }, // guard-log만이 증거다
];

function parseJsonl(path) {
  return readFileSync(path, "utf8").split("\n").filter((l) => l.trim()).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

// 트랜스크립트에서 {toolUses:[{name,command,id}], toolResults:[{isError,text}]} 추출.
// Claude Code(envelope)와 단순 {role,content} 두 형태를 모두 지원한다.
function extractToolActivity(records) {
  const toolUses = [];
  const toolResults = [];
  for (const rec of records) {
    const msg = rec.message ?? rec;
    const role = msg.role ?? rec.role;
    const content = msg.content ?? rec.content;
    if (role === "assistant" && Array.isArray(content)) {
      for (const item of content) {
        if (item?.type === "tool_use") {
          const cmd = item.input?.command ?? item.input?.cmd ?? item.input?.script ?? "";
          toolUses.push({ name: item.name ?? "", command: String(cmd), id: item.id ?? null });
        }
      }
    }
    if ((role === "user" || rec.type === "tool_result") && Array.isArray(content)) {
      for (const item of content) {
        if (item?.type === "tool_result") {
          const text = Array.isArray(item.content)
            ? item.content.filter((c) => c?.type === "text").map((c) => c.text).join("\n")
            : String(item.content ?? "");
          toolResults.push({ isError: item.is_error === true, text, toolUseId: item.tool_use_id ?? null });
        }
      }
    }
    if (role === "tool" && rec.content !== undefined) {
      toolResults.push({ isError: rec.is_error === true, text: String(rec.content), toolUseId: rec.tool_use_id ?? null });
    }
  }
  return { toolUses, toolResults };
}

function lastAssistantText(records) {
  for (let i = records.length - 1; i >= 0; i--) {
    const msg = records[i].message ?? records[i];
    if ((msg.role ?? records[i].role) === "user") return null;
    if ((msg.role ?? records[i].role) !== "assistant") continue;
    const content = msg.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      const text = content.filter((c) => c?.type === "text" || (c && typeof c.text === "string" && !c.type)).map((c) => c.text).join("\n");
      if (text.trim()) return text;
    }
  }
  return null;
}

function extractClaims(text) {
  const claims = [];
  for (const { kind, claim, tool } of CLAIM_KINDS) {
    for (const m of text.matchAll(new RegExp(claim.source, claim.flags + "g"))) {
      const line = text.slice(0, m.index).split("\n").pop() + m[0] + text.slice(m.index + m[0].length).split("\n")[0];
      claims.push({ text: line.trim().slice(0, 160), kind, tool });
    }
  }
  return claims;
}

// command가 toolUse에 매치되면 쌍을 이루는 toolResult를 찾는다.
function verdictFor(claim, { toolUses, toolResults }, guardLog) {
  if (claim.kind === "guard-blocked") {
    if (!guardLog) return { verdict: "unsupported", evidence: "no guard log provided" };
    const hit = guardLog.find((r) => r.decision === "ask" || r.decision === "block");
    return hit
      ? { verdict: "corroborated", evidence: `guard log decision=${hit.decision} codes=${(hit.codes ?? []).join(",")}` }
      : { verdict: "contradicted", evidence: "guard log has no ask/block decision" };
  }
  const matched = toolUses.filter((u) => claim.tool.test(`${u.name} ${u.command}`));
  if (!matched.length) return { verdict: "unsupported", evidence: "no matching tool execution in transcript" };
  for (const use of matched) {
    const res = toolResults.find((r) => (use.id && r.toolUseId === use.id) || (!use.id && !r.toolUseId));
    if (res && !res.isError) {
      return { verdict: "corroborated", evidence: `tool_result ok for "${use.command.slice(0, 80)}"` };
    }
    if (res?.isError) return { verdict: "contradicted", evidence: `tool_result is_error for "${use.command.slice(0, 80)}"` };
  }
  // toolResult id 매칭 실패 — 실행 자체는 있었으나 결과를 특정 못 함
  return { verdict: "unsupported", evidence: `matched ${matched.length} tool_use but no paired tool_result` };
}

function main() {
  const args = process.argv.slice(2);
  const opt = {};
  for (let i = 0; i < args.length; i += 2) opt[args[i].replace(/^--/, "")] = args[i + 1];
  if (!opt.transcript) {
    console.error("usage: claim_verifier.mjs --transcript <jsonl> [--guard-log <jsonl>] [--claims <json>] [--json]");
    process.exit(2);
  }
  const records = parseJsonl(opt.transcript);
  const activity = extractToolActivity(records);
  const guardLog = opt["guard-log"] ? parseJsonl(opt["guard-log"]) : null;

  let claims;
  if (opt.claims) {
    claims = JSON.parse(readFileSync(opt.claims, "utf8")).map((c) => {
      const kind = CLAIM_KINDS.find((k) => k.kind === c.kind);
      return { text: c.text ?? c.claim ?? "", kind: c.kind, tool: kind?.tool ?? null };
    });
  } else {
    const text = lastAssistantText(records);
    claims = text ? extractClaims(text) : [];
  }

  const results = claims.map((c) => ({ text: c.text, kind: c.kind, ...verdictFor(c, activity, guardLog) }));
  const contradicted = results.filter((r) => r.verdict === "contradicted").length;
  console.log(JSON.stringify({ claims: results, summary: { total: results.length, corroborated: results.filter((r) => r.verdict === "corroborated").length, contradicted, unsupported: results.filter((r) => r.verdict === "unsupported").length } }, null, 2));
  process.exit(contradicted ? 1 : 0);
}

main();
