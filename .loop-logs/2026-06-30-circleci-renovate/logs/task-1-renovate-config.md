# Task 1 — Renovate Config

## Task
Create `renovate.json` at the worktree root with the approved config for weekly grouped minor/patch updates (npm + dockerfile managers), major updates held on the Dashboard.

## File created
- `renovate.json` (28 lines) at worktree root `.worktrees/task-1-renovate-config/renovate.json`

## Worktree / branch
- Worktree: `.worktrees/task-1-renovate-config`
- Branch: `claude/task-1-renovate-config`

## Validation (verifiable green signal)

First attempt failed because `renovate-config-validator` is NOT a standalone npm package — it is a bin shipped inside the `renovate` package:

```
$ npx --yes renovate-config-validator renovate.json
npm error code E404
npm error 404 Not Found - GET https://registry.npmjs.org/renovate-config-validator - Not found
```

Corrected command (run the bin from the `renovate` package):

```
$ npx --yes --package renovate renovate-config-validator renovate.json
 INFO: Validating renovate.json as global config
 INFO: Config validated successfully
```

No config fields needed fixing — the JSON passed validation verbatim. (The validator labels it "global config" because options like `onboarding`/`requireConfig`/`platformCommit` are admin-level; validation still passes.)

## Dry-run skip note
Skipped the Docker dry-run (plan Task 1 Step 3): there is no `RENOVATE_TOKEN` in this environment, so it cannot run.

## Commit
```
[claude/task-1-renovate-config 36bd198] add renovate config for weekly grouped minor/patch updates
 1 file changed, 28 insertions(+)
```
