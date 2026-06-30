# Code Review — Round 1

**Timestamp:** 2026-06-30T17:10:00Z
**Loop iteration:** 1 of ≤5
**Scope:** `git diff 8295672..HEAD` — `renovate.json`, `.circleci/config.yml`, `.circleci/renovate/README.md` (config-only; no JS/TS, no test surface)

## Raw findings

### Reviewer A — enhanced-review

Taste rating: 🟢 Good taste. Gating matrix verified by hand against the full
`.circleci/config.yml` — normal push runs `branch-workflow` byte-identically to
before, tag runs `tag-workflow` (untouched), `workflow_type=dependency-update`
runs only `renovate-workflow`; Renovate's own PR push carries `workflow_type=''`
so it validates via `branch-workflow` with no re-fire loop. "Never break
userspace" holds. Verdict: **ship it**. Two minor, non-blocking findings:

- **[MINOR] `renovate.json` `onboarding` + `requireConfig` are globalOnly** —
  confirmed against `self-hosted-configuration.md`. When Renovate clones the repo
  and reads `renovate.json` as *repository* config (the real CI path), both are
  dropped with a startup warning. No functional impact (a committed config is
  already "onboarded" and satisfies `requireConfig`), but they are dead keys that
  emit a warning. This is the cause of the validator's "global config" label. Fix:
  delete them, or move to the job env (`RENOVATE_ONBOARDING`, `RENOVATE_REQUIRE_CONFIG`).
  Note: the plan's dry-run mounts the file as *global* config, so a clean dry-run
  will NOT reproduce this warning.
- **[MINOR] `packageRules` cover only major/minor/patch; `config:recommended`
  also enables `replacements:all`** whose `replacement` update type matches
  neither rule. A replacement update (deprecated/renamed package) could escape the
  `weekly-updates` group and open a *second* PR, puncturing the §8 "one combined
  PR" invariant. Near-zero probability on this repo; latent hole the grilling log
  never addressed. Fix (optional): add `"replacement"` to the grouped rule's
  `matchUpdateTypes`, or disable replacements.

Confirmed correct (not defects): `platformCommit: "enabled"` is a normal repo
option (NOT globalOnly) so the husky-bypass guarantee holds; `rangeStrategy: bump`,
`minimumReleaseAge`, `internalChecksFilter: strict`, `branchPrefix`,
`vulnerabilityAlerts/lockFileMaintenance` off — all valid, correctly spelled,
behave as spec claims; later-rule-wins collapses minor/patch into one group;
branch `chore/000/weekly-updates` satisfies the husky pattern; `renovate` job
correctly omits `checkout`; `context` attached at workflow level.

### Reviewer B — ponytail

skipped — plugin not installed.

### Reviewer C — simplify

Overall tight and well-justified; Appendix A genuinely earns the "redundant-looking"
safety options. No blocking/important. Three minor trims:

- **[MINOR] `renovate.json` `groupSlug: "weekly-updates"`** — pure redundancy.
  Renovate defaults `groupSlug` to the slugified `groupName`, and `"weekly-updates"`
  is already a valid slug, so the derived value is byte-identical. Dropping it
  yields the same branch. Safe, zero behavior change.
- **[MINOR] `.circleci/config.yml` `RENOVATE_PLATFORM: github` + `LOG_LEVEL: info`**
  both restate Renovate defaults. `RENOVATE_PLATFORM` is cheap self-documentation
  (lean keep); `LOG_LEVEL: info` adds nothing over the default.
- **[MINOR] `renovate.json` `requireConfig: "optional"`** — functionally a no-op
  here (only governs repos lacking a config; this repo commits one). Dead config
  under strict minimalism. (Overlaps with Reviewer A's finding.)

Checked and deliberately NOT flagged: gating is the simplest correct form; README
vs spec is acceptable separation of concerns (operator audience + links back);
renovate.json ↔ CI env split is clean; `dependencyDashboard: true` is correctly
non-default.

## Consolidated issues

| ID | Severity | Summary | Evidence (file:line) |
| --- | --- | --- | --- |
| R1-1 | minor | `onboarding` + `requireConfig` are globalOnly — silently dropped (with warning) when read as repo config; dead keys. Cause of validator "global config" label. | `renovate.json:4-5` |
| R1-2 | minor | `config:recommended` enables `replacements:all`; a `replacement` update type matches neither packageRule → could open a 2nd PR, denting the "one combined PR" invariant. Near-zero probability here. | `renovate.json:14-26` |
| R1-3 | minor | `groupSlug: "weekly-updates"` is redundant — equals the default slugified `groupName`. | `renovate.json:25` |
| R1-4 | minor | `RENOVATE_PLATFORM` / `LOG_LEVEL: info` restate Renovate defaults (PLATFORM = cheap self-doc; LOG_LEVEL droppable). | `.circleci/config.yml:357-358` |

(R1-1 absorbs Reviewer C's `requireConfig` finding — same root cause.)

## Disposition

- **Actionable (blocking + important) — to fix this iteration:** none.
- **Deferred (minor — NOT handled yet):**
  - R1-1 — dead globalOnly keys (`onboarding`/`requireConfig`); recommend deleting or moving to job env to silence the startup warning.
  - R1-2 — `replacement`-update one-PR hole; optional hardening (`matchUpdateTypes` += `"replacement"`).
  - R1-3 — redundant `groupSlug`.
  - R1-4 — default-equal CI env vars (`LOG_LEVEL` droppable).

**Actionable count = 0 → exit verify↔review loop after iteration 1.** Both
validators are green (verification-state.json round 1, outcome=pass). Proceed to
Stage 4.
