# LazyAgentic — Agentic Sanctuary & Prompt Governance

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Architecture: Policy Engine](https://img.shields.io/badge/Architecture-Policy%20Engine-orange.svg?style=flat-square)](RULES.md)
[![Integrity: Fail-Closed](https://img.shields.io/badge/Integrity-Fail--Closed-red.svg?style=flat-square)](rules/00-instinct.md)

> **Prompt Governance & Deterministic Policy Engine for Autonomous Coding Agents**  
> Implementing the Agentic Sanctuary architecture, situational path reference routing (`RULES.md`), and fail-closed anti-hallucination mandates.

LazyAgentic is the 4th core plugin in the Lazy series (`LAZYANTIGRAVITY`, `lazyforensic`, `lazyothers`, `lazyagentic`).

Default host: **Google Antigravity**. Keep the session UI on **Gemini 3.8 Flash (High)**. This plugin is rules-only (no hooks, no MCP). The host does not rewrite the session model per role. Enforcement is by model compliance, not mechanical blocking.

It implements the **Agentic Sanctuary** architecture adapted from vesperchant's Gemini guide:
- **Situational Path Reference System (`RULES.md` v3.28)**: On-demand modular rule loading to prevent context-window bloat. Numbers `02/05/06/10` are RESERVED.
- **Fail-Closed Instinct (`rules/00-instinct.md`)**: Anti-hallucination mandate ensuring uncertainty is verified against primary sources.
- **Natural Korean Prose Policy (`rules/03-korean-natural-prose.md`)**: Eradicating translation-ese, zero-anaphora, and AI signature cliches.
- **Dual-Mount Sanctuary**: Linked to `~/agentic` via Windows Directory Junction (macOS/Linux: symlink). If the junction is missing, agents must read `~/.gemini/config/plugins/lazyagentic/` instead. Verify with `test_integrity.ps1` (Windows) or `test_integrity.sh` (macOS/Linux).
- **Version check**: `node scripts/sync-versions.mjs [--base <plugin-dir>]` verifies `plugin.json` version/rulesVersion, `RULES.md` Version, and `00-instinct` Version (exit 1 on mismatch).
  - Hook scaffold at `hooks/intent-guard/intent-guard.mjs` is opt-in only; `plugin.json` keeps rules-only (no `hooks` key).
- **Local verification only (CI workflow not wired — workflow scope constraint)**:
  - `bash test_integrity.sh --base <plugin-dir> --junction ~/agentic`
  - `pwsh -File test_integrity.ps1 -BasePath <plugin-dir> -Junction <junction>`
  - `node scripts/sync-versions.mjs --base <plugin-dir>`
- **Enforced split (`enforced/`)**: a separate opt-in plugin (`lazyagentic-enforced`) bundling PreToolUse intent-guard + Stop turn-audit + MCP lint-rules. Clone it as its own plugin directory — see `enforced/README.md`. The main plugin stays rules-only.

## Lazy ecosystem (repo boundaries)

- `LAZYANTIGRAVITY` — runtime umbrella: hook aggregation, shared-skill materialization, bundled MCP runtimes
- `lazyforensic` — forensic / Korean-law domain plugin
- `lazyothers` — legal-document / HWP / humanize domain plugin
- `lazyagentic` (this repo) — rules-only governance plugin (Dual-Mount `~/agentic`)
- [`korean-law-mcp`](https://github.com/daeryundf2-prog/korean-law-mcp) — Korean-law MCP server, cloned+built by lazyforensic

Shared asset: `scripts/coverage_audit.mjs` is kept byte-identical across lazyforensic (canonical), lazyothers, and LAZYANTIGRAVITY — sync all three on change.