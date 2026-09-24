import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const verifier = join(root, "scripts/claim_verifier.mjs");

function sandbox(t) {
  const dir = mkdtempSync(join(tmpdir(), "lazyagentic-e2e-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function run(script, input, cwd, extra = {}) {
  const env = { ...process.env, HOME: cwd, USERPROFILE: cwd };
  delete env.LAZYAGENTIC_GUARD_LOG;
  delete env.LAZYAGENTIC_GUARD_MODE;
  return spawnSync(process.execPath, [script], { cwd, env: { ...env, ...extra }, input, encoding: "utf8", timeout: 5000 });
}

// 호스트가 실제로 보내는 형태: assistant 메시지는 content 배열에
// text + tool_use가 섞이고, tool_result는 user 롤 레코드로 돌아온다.
function realisticTranscript(dir, finalText) {
  const path = join(dir, "transcript.jsonl");
  writeFileSync(path, [
    { type: "user", message: { role: "user", content: [{ type: "text", text: "테스트 돌려줘" }] } },
    { type: "assistant", message: { role: "assistant", content: [
      { type: "text", text: "테스트를 실행합니다." },
      { type: "tool_use", id: "tu_1", name: "Bash", input: { command: "npm test" } },
    ] } },
    { type: "user", message: { role: "user", content: [
      { type: "tool_result", tool_use_id: "tu_1", content: "25 passed", is_error: false },
    ] } },
    { type: "assistant", message: { role: "assistant", content: [{ type: "text", text: finalText }] } },
  ].map(JSON.stringify).join("\n"));
  return path;
}

test("installed plugin resolves hooks.json and audits a realistic PreToolUse payload", (t) => {
  const dir = sandbox(t);
  const installed = join(dir, "plugin");
  cpSync(join(root, "enforced"), installed, { recursive: true });
  const manifest = JSON.parse(readFileSync(join(installed, "plugin.json"), "utf8"));
  const hooksConf = JSON.parse(readFileSync(join(installed, manifest.hooks), "utf8"));
  const command = hooksConf.hooks.PreToolUse[0].hooks[0].command;
  const script = command.slice(6, -1).replace("${PLUGIN_ROOT}", installed);
  // 실제 호스트 페이로드 형태 (session_id/cwd 포함, tool_input.command)
  const payload = {
    session_id: "sess-e2e", cwd: dir, hook_event_name: "PreToolUse",
    tool_name: "Bash", tool_input: { command: "rm -rf ~/build" },
  };
  const res = run(script, JSON.stringify(payload), dir);
  assert.equal(res.status, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  assert.equal(out.hookSpecificOutput.permissionDecision, "ask");
});

test("Stop hook audits only the final assistant text in a mixed transcript", (t) => {
  const dir = sandbox(t);
  const guard = join(root, "enforced/hooks/intent-guard/intent-guard.mjs");
  // 중간 assistant 텍스트는 tool_use와 섞여 있음 — 마지막 텍스트만 감사해야 한다
  const transcript = realisticTranscript(dir, "Great question! 모든 테스트가 통과했습니다.");
  const res = run(guard, JSON.stringify({ hook_event_name: "Stop", transcript_path: transcript, session_id: "s1", stop_hook_active: false }), dir);
  assert.equal(res.status, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  assert.match(out.systemMessage, /praise opener/);
  // 깨끗한 마지막 턴 — 중간 tool_use 레코드가 텍스트로 오인되면 안 된다
  const cleanTranscript = realisticTranscript(dir, "검토 범위: 테스트 실행 결과. 25 passed 확인했습니다.");
  const clean = run(guard, JSON.stringify({ hook_event_name: "Stop", transcript_path: cleanTranscript }), dir);
  assert.deepEqual(JSON.parse(clean.stdout), {});
});

test("claim verifier corroborates claims against paired tool_results", (t) => {
  const dir = sandbox(t);
  const transcript = realisticTranscript(dir, "모든 테스트가 통과했습니다. 확인 완료.");
  const proc = spawnSync(process.execPath, [verifier, "--transcript", transcript], { encoding: "utf8", timeout: 5000 });
  assert.equal(proc.status, 0, proc.stderr);
  const out = JSON.parse(proc.stdout);
  const testsClaim = out.claims.find((c) => c.kind === "tests-pass");
  assert.equal(testsClaim.verdict, "corroborated");
});

test("claim verifier contradicts a claim when the tool_result is an error", (t) => {
  const dir = sandbox(t);
  const path = join(dir, "fail-transcript.jsonl");
  writeFileSync(path, [
    { type: "assistant", message: { role: "assistant", content: [
      { type: "tool_use", id: "tu_9", name: "Bash", input: { command: "npm test" } },
    ] } },
    { type: "user", message: { role: "user", content: [
      { type: "tool_result", tool_use_id: "tu_9", content: "3 failed", is_error: true },
    ] } },
    { type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "테스트가 통과했습니다." }] } },
  ].map(JSON.stringify).join("\n"));
  const proc = spawnSync(process.execPath, [verifier, "--transcript", path], { encoding: "utf8", timeout: 5000 });
  assert.equal(proc.status, 1); // contradicted → exit 1
  const out = JSON.parse(proc.stdout);
  assert.equal(out.claims[0].verdict, "contradicted");
});

test("claim verifier marks claims without tool evidence as unsupported", (t) => {
  const dir = sandbox(t);
  const path = join(dir, "bare.jsonl");
  writeFileSync(path, JSON.stringify({ role: "assistant", content: "빌드가 성공했고 커밋을 완료했습니다." }));
  const proc = spawnSync(process.execPath, [verifier, "--transcript", path], { encoding: "utf8", timeout: 5000 });
  const out = JSON.parse(proc.stdout);
  assert.equal(proc.status, 0);
  assert.ok(out.claims.length >= 2);
  assert.ok(out.claims.every((c) => c.verdict === "unsupported"));
});

test("claim verifier checks guard-blocked claims against the decision log", (t) => {
  const dir = sandbox(t);
  const log = join(dir, "decisions.jsonl");
  const guard = join(root, "enforced/hooks/intent-guard/intent-guard.mjs");
  // 가드를 실제로 실행해 로그를 만든다 — 진짜 도구 출력이 증거다
  run(guard, JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "rm -rf /tmp/x" } }), dir, { LAZYAGENTIC_GUARD_LOG: log });
  const path = join(dir, "claims-transcript.jsonl");
  writeFileSync(path, JSON.stringify({ role: "assistant", content: "위험 명령을 차단했습니다." }));
  const proc = spawnSync(process.execPath, [verifier, "--transcript", path, "--guard-log", log], { encoding: "utf8", timeout: 5000 });
  const out = JSON.parse(proc.stdout);
  const claim = out.claims.find((c) => c.kind === "guard-blocked");
  assert.equal(claim.verdict, "corroborated");
});
