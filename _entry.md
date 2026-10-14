---
trigger: always_on
---
# LazyAgentic Global Rule Entry Point
When host `<user_rules>` already pre-inject core invariants (`00-instinct`, `03-korean-natural-prose`), apply them immediately without Turn-1 `view_file` reads. Otherwise (or on drift), consult `~/agentic/` (fallback plugin path):
1. `RULES.md` 2. `rules/00-instinct.md` 3. `rules/03-korean-natural-prose.md`
Load situational `rules/##-name.md` files on demand at most once per session when triggered.
## Universal CLI Execution Mandate
- Canonical SSOT: `rules/08-cli-execution.md` (Dual-Mount: `~/agentic/` or plugin path).
- Shell tool names vary (`Shell`/`Bash`/`run_command`); same safety rules apply.
