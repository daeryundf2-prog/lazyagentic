# LazyAgentic — Agentic Sanctuary & Prompt Governance

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Architecture: Policy Engine](https://img.shields.io/badge/Architecture-Policy%20Engine-orange.svg?style=flat-square)](RULES.md)
[![Integrity: Fail-Closed](https://img.shields.io/badge/Integrity-Fail--Closed-red.svg?style=flat-square)](rules/00-instinct.md)

> **Prompt Governance & Deterministic Policy Engine for Autonomous Coding Agents**  
> Implementing the Agentic Sanctuary architecture, situational path reference routing (`RULES.md`), and fail-closed anti-hallucination mandates.

LazyAgentic is the 4th core plugin in the Lazy series (`LAZYANTIGRAVITY`, `lazyforensic`, `lazyothers`, `lazyagentic`).

LazyAgentic is the governance plugin in the Lazy series. The main plugin is **rules-only**: no registered hooks, MCP servers, startup processes, installers, telemetry, or model switching. Enforcement depends on model compliance, not mechanical blocking. Host-specific entry files lead to `_entry.md` and `RULES.md`.

## What ships

- **9 rule modules**, routed on demand by `RULES.md` v3.28.0. Numbers `02/05/06/10` are reserved.
- Primary-source verification, uncertainty disclosure, workspace safety, scope reporting, Korean narrative style, and modern Go guidance.
- Optional Dual-Mount access through `~/agentic` (Windows junction or POSIX symlink). When absent, use the installed plugin path. No link is created automatically.
- **Separate opt-in package `enforced/`**: two hook registrations using one duplicated guard implementation, plus one persistent stdio MCP prose-scanner tool with 13 regex rules. See [enforced/README.md](enforced/README.md) for installation-root selection, host adapters, mode semantics, and limits.

The optional package is heuristic assistance, not a forensic collector, source verifier, security sandbox, or guarantee that a host blocks an operation. The main manifest remains unchanged when these files are present.

## Evidence preservation

Style rules apply to analyst-authored narrative, not originals or extracted evidence. Preserve quotations, transcripts, OCR output, names, dates, numbers, identifiers, and citations verbatim. Keep observations, source quotations, and interpretations distinct; record source locations and disclose gaps. Work on copies when transformation is authorized. The scanner is advisory and never rewrites sources; callers explicitly mark source text or quotation lines to exclude.

## Verification and CI

GitHub Actions defines Linux Node 24 integrity/syntax/unit checks and Windows PowerShell integrity checks. No dependency installation is needed for this repository. From its root:

```bash
bash test_integrity.sh --base . --junction ./missing-junction
pwsh -File test_integrity.ps1 -BasePath . -Junction ./missing-junction
node scripts/sync-versions.mjs --base .
node --test enforced/mcp/lint-rules/test/*.test.mjs
node enforced/mcp/lint-rules/eval/run_eval.mjs
node --check hooks/intent-guard/intent-guard.mjs
node --check enforced/hooks/intent-guard/intent-guard.mjs
node --check enforced/mcp/lint-rules/src/cli.mjs
```

A missing junction is a warning unless integrity `--strict` / `-Strict` is requested. Integrity strict mode only controls the filesystem verification script; it is unrelated to `LAZYAGENTIC_GUARD_MODE=strict`. Version checks align the rules track while checking presence of the independent plugin and instinct version tracks.

Tests cover scanner behavior, corpus thresholds, a real child-process stdio client, guard logging and modes, duplicate consistency, and simulated installation outside the working directory. They do not prove live host integration or real-world forensic accuracy. The original 60-row corpus remains a baseline; added synthetic Korean report cases test preservation and benign names/numbers. The evaluation script reports metrics; unit assertions enforce thresholds. No lint/typecheck package commands are defined; JavaScript syntax and behavior checks are the local gates.

## Repository boundaries

- `lazyagentic` (this repository): governance rules and optional local heuristics.
- `LAZYANTIGRAVITY`: runtime umbrella, hook aggregation, shared skills, bundled MCP runtimes.
- `lazyforensic`: forensic and Korean-law domain plugin.
- `lazyothers`: legal-document, HWP, and humanize domain plugin.
- `korean-law-mcp`: separate Korean-law server maintained with the domain plugin.

No capabilities from those other repositories are bundled or activated by the main LazyAgentic manifest.
