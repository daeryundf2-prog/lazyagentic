import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../src/cli.mjs", import.meta.url));

test("persistent stdio client initializes, lists, calls and receives protocol errors", async (t) => {
  const env = { ...process.env };
  delete env.LAZYAGENTIC_LINT_LOG;
  const child = spawn(process.execPath, [cli], { env, stdio: ["pipe", "pipe", "pipe"] });
  const pending = new Map();
  const unexpected = [];
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const lines = createInterface({ input: child.stdout });
  lines.on("line", (line) => {
    try {
      const response = JSON.parse(line);
      const receive = pending.get(response.id);
      if (receive) { pending.delete(response.id); receive(response); }
      else unexpected.push(line);
    } catch { unexpected.push(line); }
  });
  const closed = new Promise((resolve) => child.once("close", resolve));
  t.after(async () => { lines.close(); child.kill(); await closed; });
  const send = (value) => child.stdin.write(`${JSON.stringify(value)}\n`);
  const request = (value, raw) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(value.id); reject(new Error(`No response for ${value.method}`)); }, 2000);
    pending.set(value.id, (response) => { clearTimeout(timer); resolve(response); });
    if (raw) child.stdin.write(raw);
    else send({ jsonrpc: "2.0", ...value });
  });
  const init = await request({ id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "local-contract-test", version: "1" } } });
  assert.equal(init.jsonrpc, "2.0");
  assert.equal(init.result.protocolVersion, "2024-11-05");
  assert.deepEqual(init.result.capabilities, { tools: {} });
  send({ jsonrpc: "2.0", method: "notifications/initialized" });
  const listed = await request({ id: 2, method: "tools/list" });
  assert.equal(listed.result.tools.length, 1);
  const tool = listed.result.tools[0];
  assert.equal(tool.name, "scan_korean_prose");
  assert.deepEqual(tool.inputSchema.required, ["text"]);
  assert.equal(tool.inputSchema.properties.text.type, "string");
  const called = await request({ id: 3, method: "tools/call", params: { name: tool.name, arguments: { text: "이 기능은 매우 중요합니다." } } });
  assert.equal(called.result.content[0].type, "text");
  assert.equal(JSON.parse(called.result.content[0].text).violations[0].rule, "cliche-very-important");
  const clean = await request({ id: "clean", method: "tools/call", params: { name: tool.name, arguments: { text: "원본 2개를 확인했다." } } });
  assert.deepEqual(JSON.parse(clean.result.content[0].text).violations, []);
  for (const args of [{}, { text: 3 }, { text: "문장", preservedLines: [0] }, { text: "문장", contentKind: "unknown" }, { text: "문장", extra: true }]) {
    const response = await request({ id: 4, method: "tools/call", params: { name: tool.name, arguments: args } });
    assert.equal(response.error.code, -32602);
  }
  assert.equal((await request({ id: 5, method: "tools/call", params: { name: "absent", arguments: { text: "문장" } } })).error.code, -32602);
  assert.equal((await request({ id: 6, method: "absent" })).error.code, -32601);
  assert.equal((await request({ id: null, method: "malformed" }, "not-json\n")).error.code, -32700);
  assert.equal((await request({ id: null, method: "invalid" }, "[]\n")).error.code, -32600);
  send({ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: 88 } });
  assert.deepEqual((await request({ id: 7, method: "ping" })).result, {});
  child.stdin.end();
  assert.equal(await closed, 0);
  assert.equal(stderr, "");
  assert.deepEqual(unexpected, []);
});
