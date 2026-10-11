# 14. Decision Trailers on Agent Commits

> **Trigger**: When an agent creates a git commit (`git commit`, a commit tool, or a commit step inside a harness workflow).

## Directives

1. **Append trailers to every agent-made commit**, after the body and before any `Co-Authored-By` line:
   - `Constraint:` the requirement or limit that shaped this change.
   - `Rejected:` alternatives considered and why they lost (`none` if there were none).
   - `Confidence: low | med | high`
   - `Scope-risk:` what else this change could affect.
   - `Tested:` the exact command(s) that ran, with the result.
   - `Not-tested:` what was not verified, and why.

2. **No invented evidence**: `Tested:` names only commands that actually ran in this session. If nothing ran, write `Tested: none` and fill `Not-tested:`; do not leave it blank or paraphrase a test you did not run.

3. **Keep it short**: one line per trailer. Detail belongs in the body.

4. **Repository conventions win**: when the repository's own contribution guide forbids trailers or prescribes another format, follow the repository and state the conflict in the body instead.

## Rationale

Decisions and test coverage end up in history where `git log --grep '^Not-tested:'` can find them, at almost no cost per commit. Mechanism adopted from the Gajae Code AGENTS.md commit protocol (MIT); wording is original.
