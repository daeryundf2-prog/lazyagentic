# Agent Global Rule Set — Situational Path Reference System

> **Created**: 2025-09-20 23:06 KST  
> **Last updated**: 2026-09-04 17:15 KST  
> **Modified by**: Gemini 3.8 Flash (High), Antigravity  
> **Version**: 3.28.0 (LazyAgentic Curated Edition)  

This file is the single, authoritative entry point for all AI agents (Gemini/Antigravity, Claude Code, Codex, etc.). It establishes a lightweight, on-demand situational routing system that prevents context-window bloat and token fatigue.

**Antigravity + Gemini 3.8:** keep the session UI on Gemini 3.8 Flash (High). `~/agentic/` is a Directory Junction to this plugin. If that path is missing, read the same files under `~/.gemini/config/plugins/lazyagentic/`.

---

## 1. CRITICAL MANDATES & SINGLE SESSION READ PRINCIPLE

1. **Mandatory Session Start Read**:
   - At the start of every session, before performing any tasks or replying to the user, you MUST read the following entry point files unconditionally:
     1. `~/agentic/rules/00-instinct.md` (Absolute top-level mandate: resolve uncertainty against primary source or stop and report; fail-closed instinct)
     2. `~/agentic/rules/03-korean-natural-prose.md` (Korean Natural Prose and Syntax Policy: eliminate translation-ese, zero-anaphora, no AI cliches, idiomatic Korean)

2. **Situational Trigger Rule Read**:
   - Before performing any task that matches a situational trigger listed in Section 2, you MUST read the referenced rule file (`~/agentic/rules/##-name.md`) with your file reading tool and strictly adhere to every instruction inside it without exception.

3. **Single Session Read Principle**:
   - **Do NOT re-read a rule file if you have already read it in the current session.**
   - Once a target rule file (`~/agentic/rules/##-name.md`) has been loaded into your context during the active session, refrain from executing redundant re-reads when encountering subsequent triggers for that file. Rely strictly on the recalled rule directives in your context memory.
   - **Drift exception**: if you catch yourself violating a rule, or the user points out a rule violation, or the session has grown long enough that recalled directives feel vague, re-read that specific rule file immediately. Prompt decay across turns is a documented failure mode — a re-read on drift is mandatory, not redundant.

---

## 2. SITUATIONAL TRIGGERS & REFERENCED RULE PATHS

> Numbers `02/05/06/10` are RESERVED (not missing).

Consult and read the target rule file immediately when your task matches any of the following situational triggers:

### 00. Mandatory Session Start & Uncertainty Resolution
- **Trigger**: Mandatory at session start, or whenever encountering any element whose identity, value, code path, schema, or meaning is unconfirmed or uncertain.
- **Target Path**: [~/agentic/rules/00-instinct.md](~/agentic/rules/00-instinct.md)
- **Directive**: Absolute mandate: Never guess or speculate. Resolve uncertainty either by confirming against a ground-truth primary source or by stopping work immediately to report to the user.

### 01. Harness Project Record Management (`.harness/`)
- **Trigger**: When the active project contains a `.harness/` directory in the workspace root, or when authoring/updating implementation plans, session histories, handoffs, or walkthroughs.
- **Target Path**: [~/agentic/rules/01-harness-records.md](~/agentic/rules/01-harness-records.md)
- **Directive**: When `.harness/` exists in the workspace root, recording history, plans, walkthroughs, and handoffs is mandatory. When `.harness/` is absent, the rule remains inert—do NOT force creation of `.harness/` or clutter projects.

### 03. Korean Natural Prose & Syntax Policy
- **Trigger**: Mandatory at session start, and whenever authoring Korean prose, explanations, conversational answers, markdown documents, commits, or status logs.
- **Target Path**: [~/agentic/rules/03-korean-natural-prose.md](~/agentic/rules/03-korean-natural-prose.md)
- **Directive**: Enforce context-driven subject omission (zero-anaphora); eliminate translation-ese (double passives, by-passives, abstract subjects, structural metaphor suffixes `~ 축`, `~경험을 보유하다`, empty savior formulas `책임지고 통제하다`, redundant `투입 첫날부터` filler); enforce anti-parroting and solution-first rules; eradicate AI cliches under the removal-only rule; and maintain ending variety and rhythm harmony.

### 04. Korean Verb Precision & Prohibited Lexicon Policy
- **Trigger**: When communicating in Korean, writing user-facing documentation, committing messages, or formulating status logs.
- **Target Path**: [~/agentic/rules/04-korean-verb-usage.md](~/agentic/rules/04-korean-verb-usage.md)
- **Directive**: Strictly ban `박다` across all inflections, non-technical mimetic expressions, body metaphors, and colloquial slang. Enforce approved technical verb mapping across all technical operations.

### 07. Response Visualization & Terminal Formatting
- **Trigger**: When rendering tables, visual UI elements, terminal code snippets, or structured response displays.
- **Target Path**: [~/agentic/rules/07-response-visualization.md](~/agentic/rules/07-response-visualization.md)
- **Directive**: Structure comparisons with GFM tables, use GitHub alert blocks for critical notices, quote parentheses in Mermaid diagrams, specify language IDs on all code blocks, and place parentheses outside markdown bold delimiters.

### 08. CLI Command Execution & Safety
- **Trigger**: When executing shell commands via `Shell` / `Bash` / `run_command` / `execute_command`, writing CLI scripts, or executing terminal actions.
- **Target Path**: [~/agentic/rules/08-cli-execution.md](~/agentic/rules/08-cli-execution.md)
- **Directive**: Enforce clean, safe, and workspace-contained command execution. Respect Windows PowerShell syntax and environment boundaries.

### 09. Modern Go Development Guidelines (JetBrains Modernizer)
- **Trigger**: When authoring, editing, refactoring, or reviewing Go (`.go`, `go.mod`, `go.work`) code.
- **Target Path**: [~/agentic/rules/09-go-modern-guidelines.md](~/agentic/rules/09-go-modern-guidelines.md)
- **Directive**: Enforce modern Go idioms (Go 1.21~1.27) based on JetBrains Modernizer standards. Strictly eliminate deprecated or anti-pattern Go code (`interface{}` -> `any`, manual loops -> `slices`/`maps`, `if-else` min/max -> built-in `min`/`max`, `for i:=0; i<n; i++` -> `for i := range n`, nested nil fallback -> `cmp.Or`, `sync.OnceValue`, `errors.AsType`, `t.Context()`, `json:",omitzero"`).

### 11. Evidence Required & Diagnostic Verification
- **Trigger**: When stating technical conclusions, diagnosing runtime/test failures, or claiming performance or behavior facts.
- **Target Path**: [~/agentic/rules/11-evidence-required.md](~/agentic/rules/11-evidence-required.md)
- **Directive**: Base every claim strictly on un-truncated primary logs or verified command outputs. Never diagnose without log evidence; justify every debug edit with tracebacks.

### 12. Exhaustive Enumeration & Uncovered-Scope Declaration
- **Trigger**: When the user asks to enumerate, list, review, audit, or inventory items (전부/모두/빠짐없이/전수, "review all", "list every").
- **Target Path**: [~/agentic/rules/12-exhaustive-enumeration.md](~/agentic/rules/12-exhaustive-enumeration.md)
- **Directive**: Anchor item counts mechanically to the source; never collapse enumeration into top-N salience picks; attach per-item evidence anchors; declare uncovered scope at the end of every enumeration; completeness claims require coverage receipts.

### 13. Technology Vetting & Dependency Gate
- **Trigger**: When evaluating, recommending, comparing, or integrating external open-source tools, frameworks, models, or dependencies into the Lazy ecosystem.
- **Target Path**: [~/agentic/rules/13-tech-vetting-gate.md](~/agentic/rules/13-tech-vetting-gate.md)
- **Directive**: Enforce the 3 Mandatory Hard Gates: Legal Defensibility Gate (Chain of Custody CoC preservation, strict ban on third-party hosted proxies in evidence collection, tamper-evident vs tamper-proof distinction); Dependency Cost Gate (no hiding GPU/Docker/Cloud costs, enforce BYOB for heavy models, ban unverified marketing claims like "99%"); Receipt-First Policy (never claim total counts or metrics without pre-computed mechanical receipts).