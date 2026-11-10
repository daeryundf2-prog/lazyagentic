# 16. Single Writer Per Repository

> **Title**: Single Writer Per Repository  
> **Rule ID**: 16  
> **Scope**: Global (Antigravity, Claude Code, Codex, LazySeries Agents)  
> **Trigger**: When more than one agent, lane, or subagent works at the same time in one repository or worktree, or when delegating work that could stage, commit, or push.
> **Source**: hard-boundary and conflict-resolution ideas adapted from hypercore `skills/hyper-git/rules/agent-parallelism.md` (MIT, (c) 2026 alpoxdev; see `NOTICE`). Wording rewritten.

---

## 1. WHY

같은 저장소의 인덱스(스테이징 영역)와 커밋 이력은 모든 작업자가 함께 쓴다. 두 레인이 동시에 add/commit하면 서로의 변경이 한 커밋에 섞이거나 한쪽 작업이 사라진다. 읽기와 초안 작성은 동시에 해도 안전하므로, 쓰기만 한 명에게 모은다. 규칙은 권고(advisory)이며 모델 준수에 의존한다.

## 2. THE RULE

1. In one repository only **one writer** stages, commits, or pushes at a time. Everyone else analyzes and drafts only.
2. Before starting, state the paths you will write. If another live lane writes the same repository, ask the lead instead of committing.
3. A helper lane (subagent, reviewer, verifier) is told in its prompt not to run `git add`, `commit`, `push`, `reset`, `rebase`, `clean`, or `restore`. It may read, run read-only commands, and propose groupings and messages.
4. The writer owns the final grouping, the commit message, staging, committing, and pushing.
5. Push only after every intended commit group has succeeded.
6. Use a separate clone or worktree per writer when two lanes truly must change the same repository in parallel; a separate checkout is a separate repository for this rule.

## 3. CONFLICTS

| Conflict | Resolution |
|---|---|
| Two lanes disagree on commit grouping | Prefer the grouping backed by the diff evidence; rewrite the message after the group is final. |
| A safety check reports a blocker | Stop writing and report the blocker. |
| A lane's repository map disagrees with the repository boundary | Re-inspect that boundary before staging. |
| A lane's output predates later edits or hooks | Refresh status and re-verify before push. |

## 4. LIMITS

- Applies to git state; it does not stop two lanes from editing different checkouts.
- It does not change commit identity or message style; follow the repository's history for those.
- Irreversible steps such as force-push or release are still gated by rule 17.
