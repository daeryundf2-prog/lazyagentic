# lazyagentic-enforced — Optional Guard and Prose Scanner

The package name is historical: this is opt-in heuristic assistance, not an OS sandbox or factual-evidence verifier. The main `lazyagentic` plugin remains rules-only. Node.js 20 or newer is required; there are no third-party dependencies or installation scripts.

## Installation root and host integration

Use the **contents of this `enforced/` directory** as the installed `lazyagentic-enforced` package root. That root must directly contain `plugin.json`, `hooks.json`, `hooks/`, `mcp_config.json`, and `mcp/`. Cloning the entire repository into a differently named folder is not sufficient: its root manifest is still rules-only. Alternatively, explicitly register the existing `enforced/` directory if the host supports selecting a package root.

Do not overwrite an existing installation without reviewing local changes. Installing this package does not require modifying the main plugin or creating a global junction.

The supplied configuration uses `${PLUGIN_ROOT}` for absolute entrypoint resolution. The host must expand it to the **enforced package root**, not the main repository root. Hook executable paths are quoted for spaces; MCP paths are individual argv entries. If the host does not support this variable, substitute the installed absolute path in its configuration. For Claude Code plugin loading, use its `${CLAUDE_PLUGIN_ROOT}` variable in the host registration or an explicit absolute path. Do not assume Gemini/Antigravity hook names and response schemas match Claude Code.

The guard emits Claude-style `hookSpecificOutput` for PreToolUse and `decision: block` for Stop. End-to-end enforcement is supported only by a host that honors those envelopes and supplies the documented payload. The offline tests verify our JSON contract and simulated path expansion, not installation in any live IDE. No hooks are automatically registered by a script in this repository.

## Guard behavior

Input is a single JSON object on stdin, terminated by EOF. Supported events are `PreToolUse` and `Stop`, named by `hook_event_name` (or `event` / `type`). PreToolUse accepts `tool_name` / `toolName` / `tool.name` and command-bearing input objects. Stop accepts `transcript_path` / `transcriptPath`, containing JSONL records with `role` and `content`, directly or inside `message`. Text strings and text content blocks are supported. Unsupported transcript formats are unavailable, never guessed from arbitrary tail lines.

| Condition | Default mode | `LAZYAGENTIC_GUARD_MODE=strict` |
| --- | --- | --- |
| Recognized command risk | Ask for permission | Ask for permission |
| Valid command, no pattern hit | Allow with heuristic disclaimer | Same |
| Current-turn style/scope finding | Advisory `systemMessage` | Stop `decision: block` |
| Malformed/missing input or transcript | Fail open: `{}` | PreToolUse asks; Stop blocks; unknown event stops via `continue: false` |
| Stop reinvocation with `stop_hook_active: true` | Advisory | Advisory, avoiding an endless block loop |

Strict mode is a best-effort host decision policy, not fail-closed process isolation. A missing Node executable, host timeout, ignored response, or logging failure cannot be controlled by the script. Registrations set a five-second host timeout. Guard input and transcript size are capped at 8 MiB; oversized/unavailable data follows the mode policy. Only the newest assistant/model record is audited; prior turns, user text and tool-result text are not audited as assistant claims. The guard does not infer truth from keywords and does not flag uncertainty disclosures as unsupported claims. Command repetition alone is not treated as evidence of repeated failure. Commands are never executed by the guard.

## MCP and source preservation

`mcp/lint-rules/src/cli.mjs` serves persistent newline-delimited JSON-RPC 2.0 on stdio. It negotiates MCP protocol `2024-11-05` and supports `initialize`, `ping`, `tools/list`, and `tools/call`. Notifications receive no reply. Parse/request/method/argument failures produce JSON-RPC errors; scanner execution failures produce MCP `isError` results. No network transport, resource subscription, or filesystem editing is implemented.

The single tool `scan_korean_prose` accepts:

- `text`: required string.
- `contentKind`: `narrative` (default) or `source`. Source text is excluded from stylistic linting.
- `preservedLines`: optional 1-based line numbers to exclude, including quotations, names, or extracted originals in mixed reports.

The tool returns a text content block containing `{tool, violations, contentKind, preservedLines}`. Findings contain rule ID, original line number, and an excerpt. A clean result is not evidence verification. Quotation detection is not automatic: callers must mark source material explicitly. The scanner never rewrites supplied text or source files. Do not apply narrative edits to original evidence, transcripts, citations, or legal quotations.

## Verification

From the main repository root:

```bash
node --test enforced/mcp/lint-rules/test/*.test.mjs
node enforced/mcp/lint-rules/eval/run_eval.mjs
node --check enforced/hooks/intent-guard/intent-guard.mjs
node --check enforced/mcp/lint-rules/src/cli.mjs
```

Tests include a persistent child-process MCP client, guard mode/logging tests, byte-identical guard-copy checks, and an installation smoke test under a disposable directory with spaces and an isolated HOME. The initial 60-row corpus is retained; additional synthetic report names, numbers, quotations, and source-preservation cases exercise the expanded contract. Corpus performance does not establish accuracy on real case materials. Precision/recall thresholds are asserted by the unit suite; the evaluation script is a report only.

## Optional local logs

- `LAZYAGENTIC_GUARD_LOG`: JSONL timestamp, decision, and fixed diagnostic codes only; no command or transcript content.
- `LAZYAGENTIC_LINT_LOG`: JSONL timestamp, finding count, and rule IDs only; no excerpts.
- Unset variables create no logs. Log paths must be chosen by the operator; appends are best effort. New log files use mode 0600 where supported; existing permissions and Windows ACLs are not modified.

The MCP result still contains submitted text excerpts, which are visible to the host/model. Local processing alone does not guarantee host confidentiality. Select an approved host deployment for confidential material.
