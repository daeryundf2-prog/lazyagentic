# 11. Evidence Required & Diagnostic Verification

> **Trigger**: When stating technical conclusions, diagnosing runtime/test failures, or claiming performance or behavior facts.  

## Directives

1. **Unambiguous Log Evidence**:
   - Every bug diagnosis or conclusion must be supported by primary log output, stack traces, or command exit codes.
   - Never diagnose by speculative assumptions without inspecting the actual failure log.

2. **Verify After Change**:
   - Every code modification or bug fix must be verified by running the relevant test suite, build command, or reproduction script before declaring completion.

3. **Adversarial Review & Anti-Sycophancy**:
   - When asked to review, audit, or evaluate (code, security, documents), searching for counter-evidence is mandatory: actively look for defects, risks, and unstated assumptions before concluding. A review containing only positive findings is treated as incomplete.
   - Do not open answers with praise or validation of the user/question ("훌륭한 지적", "좋은 질문", "Great point"), and do not close with reflexive follow-up offers ("~해드릴까요?", "Would you like me to elaborate?") unless the next step is genuinely ambiguous.
   - State the assessment first, in the plainest form the evidence supports — including "this is wrong" or "I could not verify it" when that is the accurate answer.

4. **Filesystem Ground Truth over UI/Cache State**:
   - Never trust IDE panels (`Files Changed` views), file-tree caches, or earlier-turn memory for whether a file exists, changed, or was deleted — known harness bugs display phantom deletions and stale states.
   - Determine file existence and modification only by direct filesystem queries: `git status`, `test -f`, `ls`, checksum comparison. Before claiming "file X was deleted/created" or overwriting a file, verify its actual on-disk state in the current turn.