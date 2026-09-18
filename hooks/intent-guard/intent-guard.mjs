#!/usr/bin/env node
import { appendFileSync, readFileSync, statSync } from "node:fs";

const STRICT = process.env.LAZYAGENTIC_GUARD_MODE === "strict";
const MAX_BYTES = 8 * 1024 * 1024;
const PRAISE_OPENERS = [/^(좋은|훌륭한|멋진|정확한)\s*(질문|지적|아이디어|접근)/, /^great (question|point)/i, /^excellent (question|point|idea)/i, /^(absolutely|certainly)[!,]/i];
const FOLLOWUP_OFFERS = [/해\s*드릴까요/, /드릴까요[?？]?/, /would you like me to/i, /shall i (also|proceed|continue)/i, /want me to/i];
const SCOPE_DECL = /범위|미커버|다루지 않|검토하지 않|커버하지|not covered|scope|unchecked|skipped|out of scope/i;
const DESTRUCTIVE_RE = /\b(rm|del|erase|rmdir|rd|Remove-Item|Move-Item|Format-Volume)\b/i;
const RECURSIVE_OR_WILD = /(\s-[a-zA-Z]*[rRfFS])|\s\*|-Recurse|\/S(?=\s|$)/;
const VAR_EXPAND_DELETE = /\$\{?[A-Za-z_][A-Za-z0-9_]*\}?\/\*|\$[A-Za-z_][A-Za-z0-9_]*\\?\*/;
const PARAM_GUARD = /\$\{[A-Za-z_][A-Za-z0-9_]*:\?/;
const SRC_EXT = "(?:py|js|mjs|cjs|ts|tsx|jsx|json|md|yml|yaml|sh|ps1|cmd|bat|html|css|go|rs|java|c|h|cpp|rb|pl|sql)";
const SHELL_WRITE_RE = new RegExp("(?:^|[\\s;|&])(?<!\\d)>{1,2}\\s*[\"']?[^\\s\"']+\\." + SRC_EXT + "\\b|Set-Content|Out-File|Add-Content|sed\\s+-i", "i");
const REASONS = {
  clean: "No heuristic finding; this is not a safety or factuality attestation.",
  unavailable: "Guard input or current assistant transcript is unavailable.",
  variable: "rule08: variable-expanded delete requires target verification",
  quoting: "rule08: possible unquoted destructive path requires target verification",
  recursive: "rule08: recursive or wildcard operation requires target verification",
  write: "rule08: file modification via shell — use dedicated edit tools",
  praise: "rule11: praise opener",
  followup: "rule11: reflexive follow-up offer",
  scope: "rule12: enumerated list without uncovered-scope declaration",
};

function emit(payload, decision, codes) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
  try {
    const path = process.env.LAZYAGENTIC_GUARD_LOG;
    if (path) appendFileSync(path, `${JSON.stringify({ ts: new Date().toISOString(), decision, codes: codes.filter((code) => Object.hasOwn(REASONS, code)) })}\n`, { encoding: "utf8", mode: 0o600 });
  } catch {}
}

function preDecision(decision, code) {
  emit({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: decision, permissionDecisionReason: REASONS[code] } }, decision, [code]);
}

function stopDecision(codes, active) {
  const reason = codes.map((code) => REASONS[code]).join("; ");
  if (STRICT && !active) emit({ decision: "block", reason }, "block", codes);
  else emit({ systemMessage: reason }, "advisory", codes);
}

function unavailable(event, active) {
  if (!STRICT) return emit({}, "allow", ["unavailable"]);
  if (event === "PreToolUse") return preDecision("ask", "unavailable");
  if (event === "Stop") return stopDecision(["unavailable"], active);
  emit({ continue: false, stopReason: REASONS.unavailable }, "block", ["unavailable"]);
}

function commandHit(cmd) {
  if (DESTRUCTIVE_RE.test(cmd)) {
    if (VAR_EXPAND_DELETE.test(cmd) && !PARAM_GUARD.test(cmd)) return "variable";
    const stripped = cmd.replace(/"[^"]*"|'[^']*'/g, "");
    if (/[A-Za-z]:\\[^\s]+|\/[^\s]+/.test(stripped) && /\s\S+\s+\S+/.test(stripped.replace(/-\S+\s*/g, ""))) return "quoting";
    if (RECURSIVE_OR_WILD.test(cmd)) return "recursive";
  }
  return SHELL_WRITE_RE.test(cmd) ? "write" : null;
}

function lastAssistantText(transcript) {
  const lines = transcript.split("\n").filter((line) => line.trim());
  for (let i = lines.length - 1; i >= 0; i--) {
    let record;
    try { record = JSON.parse(lines[i]); } catch { return null; }
    const role = record?.role ?? record?.message?.role;
    if (role === "user") return null;
    if (role !== "assistant" && role !== "model") continue;
    const content = record.content ?? record.message?.content;
    if (typeof content === "string") return content.trim() || null;
    if (Array.isArray(content)) {
      const text = content.filter((item) => item && typeof item.text === "string" && (item.type === undefined || item.type === "text" || item.type === "output_text")).map((item) => item.text).join("\n");
      return text.trim() || null;
    }
    return null;
  }
  return null;
}

function audit(text) {
  const codes = [];
  if (PRAISE_OPENERS.some((re) => re.test(text.slice(0, 120)))) codes.push("praise");
  if (FOLLOWUP_OFFERS.some((re) => re.test(text.slice(-300)))) codes.push("followup");
  const bullets = text.split("\n").filter((line) => /^\s*(?:[-*•]|\d+[.)])\s+\S/.test(line)).length;
  if (bullets >= 3 && !SCOPE_DECL.test(text)) codes.push("scope");
  return codes;
}

async function main() {
  let event;
  let active = false;
  try {
    let raw = "";
    for await (const chunk of process.stdin) {
      raw += chunk;
      if (Buffer.byteLength(raw) > MAX_BYTES) throw new Error();
    }
    const input = JSON.parse(raw);
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error();
    event = input.hook_event_name ?? input.event ?? input.type;
    active = input.stop_hook_active === true;
    if (event === "PreToolUse") {
      const name = input.tool_name ?? input.toolName ?? input.tool?.name;
      if (typeof name !== "string" || !name) return unavailable(event, active);
      if (!/shell|bash|command|run|exec|terminal|powershell/i.test(name)) return emit({}, "allow", ["clean"]);
      const args = input.tool_input ?? input.toolInput ?? input.parameters ?? input.args ?? input.input;
      const cmd = args?.command ?? args?.cmd ?? args?.shell_command ?? args?.script;
      if (typeof cmd !== "string" || !cmd.trim()) return unavailable(event, active);
      const code = commandHit(cmd);
      return preDecision(code ? "ask" : "allow", code ?? "clean");
    }
    if (event !== "Stop") return unavailable(event, active);
    const path = input.transcript_path ?? input.transcriptPath;
    if (typeof path !== "string" || !path) return unavailable(event, active);
    const stat = statSync(path);
    if (!stat.isFile() || stat.size > MAX_BYTES) return unavailable(event, active);
    const text = lastAssistantText(readFileSync(path, "utf8"));
    if (text === null) return unavailable(event, active);
    const codes = audit(text);
    if (codes.length) return stopDecision(codes, active);
    emit({}, "allow", ["clean"]);
  } catch { unavailable(event, active); }
}

main();
