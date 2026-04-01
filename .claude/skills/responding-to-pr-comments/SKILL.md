---
name: responding-to-pr-comments
description: Use when there are PR review comments to address, when a reviewer has left feedback on a pull request, or when asked to react to or handle PR comments on the current branch.
---

# Responding to PR Comments

## Overview

PR review comments require structured handling — not just blind compliance or vague "I'll push back if they're wrong." Each comment must be evaluated against context (commit history + PR description), fixed with TDD if valid, or explicitly rejected with justification.

**REQUIRED SUB-SKILL:** Use `superpowers:test-driven-development` for every fix.

## Process

**Step 1 — Read context FIRST, comments SECOND**

Before reading comments, understand what was intentionally built:

```bash
gh pr view --json title,body,commits         # PR description and decisions
git log main..HEAD --oneline                  # Commit history for this branch
```

This prevents "fixing" things that were intentionally done a certain way.

**Step 2 — Fetch all PR comments**

```bash
gh pr view --json number --jq '.number'       # Get PR number
gh pr view <PR_NUMBER> --comments             # Review comments
gh api repos/{owner}/{repo}/pulls/<PR_NUMBER>/reviews  # Formal reviews
```

**Step 3 — Evaluate validity for EACH comment**

For each comment, decide: **Valid** or **Invalid**.

| Valid | Invalid |
|-------|---------|
| Points to a real bug or regression | Contradicts an intentional design decision documented in commit history |
| Identifies missing test coverage | Reviewer misunderstood the context (explain, don't comply) |
| Catches a logic error | Pure style preference with no correctness impact |
| Flags missing error handling at system boundary | Already addressed in a later commit (stale) |

**Red flag:** "The reviewer seems right, so I'll just fix it" without reading the commit history is NOT a validity check.

**Step 4 — Fix valid issues with TDD**

For each valid issue:

1. Write a failing test that captures the bug/requirement the reviewer identified
2. Verify the test fails (RED)
3. Write minimal code to make it pass (GREEN)
4. Run full test + lint suite:
   ```bash
   just test-unit
   just lint
   just format
   ```

Do NOT skip the failing test step. "I'll add a test after" violates TDD.

**Step 5 — Commit and push (only if there are valid fixes)**

If ALL comments were invalid: skip directly to Step 6. No commit needed.

If there are valid fixes, verify Husky is active before committing:

```bash
git config core.hooksPath   # must output: .husky
```

If active, use bare message (no prefix — Husky adds it):

```bash
git commit -m "address review comments: <brief description>"
git push
```

**Step 6 — Write a consolidated PR comment**

Post a SINGLE comment to the PR that lists every comment and its resolution:

```bash
gh pr comment <PR_NUMBER> --body "$(cat <<'EOF'
## Review Response

### Resolved
- **[Comment summary]** — Fixed. [What was changed and why.]
- **[Comment summary]** — Fixed. [What was changed and why.]

### Not addressed (invalid)
- **[Comment summary]** — Marked invalid. [Reason: contradicts design decision in commit X / already addressed in commit Y / reviewer misunderstood X because Y.]
EOF
)"
```

This is a **summary comment**, not individual replies. One comment, complete picture.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Reading comments before reading PR description + commit history | Always read context first |
| "Fixing" something the reviewer flagged without checking if it was intentional | Check git log for the rationale |
| Writing tests after the fix | Write the failing test first, always |
| Replying to each comment individually without a summary | Write one consolidated summary comment |
| Assuming Husky is active | Run `git config core.hooksPath` to verify |
| Treating all reviewer suggestions as authoritative | Evaluate each against actual correctness criteria |

## Red Flags — Stop and Re-evaluate

- "The reviewer is clearly right" without reading commit history
- Making a fix without first writing a failing test
- Committing without checking Husky status
- Closing out without posting the consolidated summary comment
