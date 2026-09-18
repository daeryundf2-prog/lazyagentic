import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const guard = join(root, "hooks/intent-guard/intent-guard.mjs");

function sandbox(t) {
  const dir = mkdtempSync(join(tmpdir(), "lazyagentic-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function run(script, input, cwd, extra = {}) {
  const env = { ...process.env, HOME: cwd, USERPROFILE: cwd };
  delete env.LAZYAGENTIC_GUARD_LOG;
  delete env.LAZYAGENTIC_GUARD_MODE;
  const result = spawnSync(process.execPath, [script], { cwd, env: { ...env, ...extra }, input, encoding: "utf8", timeout: 3000 });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("guard logs decisions without transcript or command contents", (t) => {
  const dir = sandbox(t);
  const log = join(dir, "decisions.jsonl");
  const result = run(guard, JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "node --version" } }), dir, { LAZYAGENTIC_GUARD_LOG: log });
  assert.equal(result.hookSpecificOutput.permissionDecision, "allow");
  assert.ok(existsSync(log));
  const records = readFileSync(log, "utf8").trim().split("\n").map(JSON.parse);
  assert.equal(records.length, 1);
  assert.equal(records[0].decision, "allow");
  assert.ok(records[0].ts);
  assert.equal(readFileSync(log, "utf8").includes("node --version"), false);
});

test("guard audits only latest assistant turn and accepts disclosed uncertainty", (t) => {
  const dir = sandbox(t);
  const transcript = join(dir, "transcript.jsonl");
  writeFileSync(transcript, [
    { role: "assistant", content: "Great question! Would you like me to continue?" },
    { role: "user", content: "unverified speculative assumed" },
    { message: { role: "assistant", content: [{ type: "text", text: "검토 범위: 제공된 로그. 원인은 확실하지 않습니다. Additional evidence is unverified; this is an inference." }] } },
  ].map(JSON.stringify).join("\n"));
  const clean = run(guard, JSON.stringify({ hook_event_name: "Stop", transcript_path: transcript }), dir);
  assert.deepEqual(clean, {});
  writeFileSync(transcript, JSON.stringify({ role: "assistant", content: "Great question!" }));
  const advice = run(guard, JSON.stringify({ hook_event_name: "Stop", transcript_path: transcript }), dir);
  assert.equal(advice.decision, undefined);
  assert.match(advice.systemMessage, /praise opener/);
  const strict = run(guard, JSON.stringify({ hook_event_name: "Stop", transcript_path: transcript }), dir, { LAZYAGENTIC_GUARD_MODE: "strict" });
  assert.equal(strict.decision, "block");
  const retry = run(guard, JSON.stringify({ hook_event_name: "Stop", stop_hook_active: true, transcript_path: transcript }), dir, { LAZYAGENTIC_GUARD_MODE: "strict" });
  assert.equal(retry.decision, undefined);
});

test("guard defaults fail-open while strict errors block or ask with host envelopes", (t) => {
  const dir = sandbox(t);
  assert.deepEqual(run(guard, "invalid-json", dir), {});
  assert.equal(run(guard, "invalid-json", dir, { LAZYAGENTIC_GUARD_MODE: "strict" }).continue, false);
  const event = { hook_event_name: "Stop", transcript_path: join(dir, "missing.jsonl") };
  assert.deepEqual(run(guard, JSON.stringify(event), dir), {});
  assert.equal(run(guard, JSON.stringify(event), dir, { LAZYAGENTIC_GUARD_MODE: "strict" }).decision, "block");
  const pre = { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: {} };
  const output = run(guard, JSON.stringify(pre), dir, { LAZYAGENTIC_GUARD_MODE: "strict" });
  assert.equal(output.hookSpecificOutput.permissionDecision, "ask");
  const write = { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "Out-File report.md" } };
  assert.equal(run(guard, JSON.stringify(write), dir).hookSpecificOutput.permissionDecision, "ask");
  assert.equal(existsSync(join(dir, "report.md")), false);
});

test("isolated enforced-root installation resolves hooks and MCP independently of cwd", (t) => {
  const dir = sandbox(t);
  const installed = join(dir, "plugin with spaces");
  cpSync(join(root, "enforced"), installed, { recursive: true });
  const main = JSON.parse(readFileSync(join(root, "plugin.json"), "utf8"));
  assert.equal(main.hooks, undefined);
  assert.equal(main.mcpServers, undefined);
  const manifest = JSON.parse(readFileSync(join(installed, "plugin.json"), "utf8"));
  const hooks = JSON.parse(readFileSync(join(installed, manifest.hooks), "utf8")).hooks;
  for (const event of ["PreToolUse", "Stop"]) {
    const command = hooks[event][0].hooks[0].command;
    assert.match(command, /^node "\$\{PLUGIN_ROOT\}\/hooks\/intent-guard\/intent-guard.mjs"$/);
    const script = command.slice(6, -1).replace("${PLUGIN_ROOT}", installed);
    const output = run(script, JSON.stringify({ hook_event_name: event, tool_name: "Read", tool_input: { file_path: "report.txt" } }), dir);
    assert.ok(output && typeof output === "object");
  }
  const mcp = JSON.parse(readFileSync(join(installed, manifest.mcpServers), "utf8")).mcpServers["lint-rules"];
  assert.equal(mcp.command, "node");
  assert.match(mcp.args[0], /^\$\{PLUGIN_ROOT\}\//);
  const output = run(mcp.args[0].replace("${PLUGIN_ROOT}", installed), JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "install-test", version: "1" } } }) + "\n", dir);
  assert.equal(output.result.serverInfo.name, "lint-rules");
});

test("guard copies remain byte-identical", () => {
  assert.equal(readFileSync(guard, "utf8"), readFileSync(join(root, "enforced/hooks/intent-guard/intent-guard.mjs"), "utf8"));
});
