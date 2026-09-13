#!/usr/bin/env node
// intent-guard.mjs (enforced) — copied from body hooks/intent-guard/intent-guard.mjs
// FAIL_OPEN -> ask 성격: 파싱 실패/전사 누락 시 차단하지 않고 approve(확인 질문으로 전환)
// Input: hook JSON via stdin { event, transcript_path }. Output: decision JSON to stdout.
import { readFileSync, existsSync } from "node:fs";

// --- Stop 감사용 패턴 ---
const CLAIM_KEYWORDS = ["unverified", "assumed", "speculative", "아마도", "추정컨대", "확실하지 않", "검증 없이"];
const PRAISE_OPENERS = [
  /^(좋은|훌륭한|멋진|정확한)\s*(질문|지적|아이디어|접근)/,
  /great (question|point)/i,
  /excellent (question|point|idea)/i,
  /^(absolutely|certainly)[!,]/i,
];
const FOLLOWUP_OFFERS = [/해\s*드릴까요/, /드릴까요[?？]?/, /would you like me to/i, /shall i (also|proceed|continue)/i, /want me to/i];
const SCOPE_DECL = /범위|미커버|다루지 않|검토하지 않|커버하지|not covered|scope|unchecked|skipped|out of scope/i;

// --- PreToolUse 명령 검사용 패턴 ---
const DESTRUCTIVE_RE = /\b(rm|del|erase|rmdir|rd|Remove-Item|Move-Item|Format-Volume)\b/i;
const RECURSIVE_OR_WILD = /(\s-[a-zA-Z]*[rRfFS])|\s\*|-Recurse|\/S(?=\s|$)/;
const VAR_EXPAND_DELETE = /\$\{?[A-Za-z_][A-Za-z0-9_]*\}?\/\*|\$[A-Za-z_][A-Za-z0-9_]*\\?\*/;
const PARAM_GUARD = /\$\{[A-Za-z_][A-Za-z0-9_]*:\?/;
// 소스/문서 확장자를 대상으로 한 셸 쓰기 (2> 같은 스트림 리다이렉트 제외)
const SRC_EXT = "(?:py|js|mjs|cjs|ts|tsx|jsx|json|md|yml|yaml|sh|ps1|cmd|bat|html|css|go|rs|java|c|h|cpp|rb|pl|sql)";
const SHELL_WRITE_RE = new RegExp("(?:^|[\\s;|&])(?<!\\d)>{1,2}\\s*[\"']?[^\\s\"']+\\." + SRC_EXT + "\\b|Set-Content|Out-File|Add-Content|sed\\s+-i", "i");
const SCRATCH_PATH = /^["']?(\/tmp\/|\/var\/folders\/|[A-Za-z]:\\[^"']*\\Temp\\|\$TMPDIR|%TEMP%)/i;

async function readStdin() {
  let d = "";
  for await (const c of process.stdin) d += c;
  return d.trim();
}
function glog(d, h) { try { const p = process.env.LAZYAGENTIC_GUARD_LOG; if (!p) return; appendFileSync(p, JSON.stringify({ ts: new Date().toISOString(), decision: d, hit: h }) + "\n"); } catch {} }
function out(decision, reason) {
  const o = { decision, reason };
  if (decision === "ask") o.permissionDecision = "ask";
  console.log(JSON.stringify(o)); glog(decision, reason);
}
const approve = (r) => out("approve", r);
const cont = (r) => out("continue", r);
const ask = (r) => out("ask", r);

function extractCommand(evt) {
  const name = evt.tool_name || evt.toolName || (evt.tool && evt.tool.name) || "";
  const inp = evt.tool_input || evt.toolInput || evt.parameters || evt.args || evt.input || {};
  const cmd = inp.command || inp.cmd || inp.shell_command || inp.script || "";
  const shellish = /shell|bash|command|run|exec|terminal|powershell/i.test(name) || !name;
  return shellish && typeof cmd === "string" ? cmd : "";
}

// rule 08 §5/§4/§6 검사 — 위험 명령은 ask, 반복 실패는 continue
function checkCommand(cmd, transcriptText) {
  if (!cmd) return null;
  if (DESTRUCTIVE_RE.test(cmd)) {
    if (VAR_EXPAND_DELETE.test(cmd) && !PARAM_GUARD.test(cmd))
      return { sev: "ask", hit: "rule08§5: variable-expanded delete without ${VAR:?} guard" };
    // 따옴표 구간 제거 후 경로 토큰 + 후속 토큰이 남으면 미인용 공백 경로 의심
    const stripped = cmd.replace(/"[^"]*"|'[^']*'/g, "");
    if (/[A-Za-z]:\\[^\s]+|\/[^\s]+/.test(stripped) && /\s\S+\s+\S+/.test(stripped.replace(/-\S+\s*/g, "")))
      return { sev: "ask", hit: "rule08§5: possible unquoted space in destructive path — quote and list resolved target" };
    if (RECURSIVE_OR_WILD.test(cmd))
      return { sev: "ask", hit: "rule08§5: recursive/wildcard delete — list resolved target first" };
  }
  const wm = cmd.match(SHELL_WRITE_RE);
  if (wm && !SCRATCH_PATH.test(wm[0].replace(/^[\s;|&>]+/, "")))
    return { sev: "ask", hit: "rule08§4: file modification via shell — use dedicated edit tools" };
  // §6: 동일 명령이 전사에 3회 이상 있으면 반복 루프 의심
  if (transcriptText && cmd.length > 8) {
    const n = transcriptText.split(cmd).length - 1;
    if (n >= 3) return { sev: "continue", hit: `rule08§6: identical command repeated ${n}x — stop retrying, surface the failure` };
  }
  return null;
}

function lastAssistantText(transcript) {
  const lines = transcript.split("\n").filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const j = JSON.parse(lines[i]);
      const role = j.role || (j.message && j.message.role) || "";
      if (/assistant|model/i.test(role)) {
        const c = j.content ?? (j.message && j.message.content) ?? "";
        if (typeof c === "string" && c.trim()) return c;
        if (Array.isArray(c)) { const t = c.map((x) => x && x.text).filter(Boolean).join("\n"); if (t.trim()) return t; }
      }
    } catch {}
  }
  return lines.slice(-3).join("\n"); // 비-JSONL 전사 폴백: 꼬리 3줄
}

// Stop 감사 — rule 00/11/12 최종 메시지 검사
function checkTurnAudit(text) {
  const low = text.toLowerCase();
  const hits = CLAIM_KEYWORDS.filter((k) => low.includes(k.toLowerCase()) || text.includes(k));
  const last = lastAssistantText(text);
  if (PRAISE_OPENERS.some((re) => re.test(last.trim().slice(0, 120))))
    hits.push("rule11§3: praise opener");
  const tail = last.trim().slice(-300);
  if (FOLLOWUP_OFFERS.some((re) => re.test(tail)))
    hits.push("rule11§3: reflexive follow-up offer");
  const bullets = last.split("\n").filter((l) => /^\s*(?:[-*•]|\d+[.)])\s+\S/.test(l)).length;
  if (bullets >= 3 && !SCOPE_DECL.test(last))
    hits.push("rule12§4: enumerated list without uncovered-scope declaration");
  return hits;
}

async function main() {
  let evt = {};
  try { evt = JSON.parse((await readStdin()) || "{}"); } catch { approve("unparseable input"); return; }

  let text = "";
  const tp = evt.transcript_path || evt.transcriptPath || "";
  if (tp && existsSync(tp)) { try { text = readFileSync(tp, "utf8"); } catch {} }

  // PreToolUse: 명령이 추출되면 명령 검사 우선
  const cmd = extractCommand(evt);
  const cHit = checkCommand(cmd, text);
  if (cHit) { (cHit.sev === "ask" ? ask : cont)(cHit.hit); return; }

  const event = evt.event || evt.hook_event_name || evt.type || "";
  if (/stop|postinvocation|subagentstop/i.test(event) || (!cmd && text)) {
    if (!text) { approve("no transcript — nothing to audit"); return; }
    const hits = checkTurnAudit(text);
    if (hits.length > 0) { cont(`audit hits: ${hits.join(", ")}`); return; }
    approve("turn audit clean");
    return;
  }
  approve("no auditable content");
}
main();
