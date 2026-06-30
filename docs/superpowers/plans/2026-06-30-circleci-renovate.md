# Self-Hosted Weekly Renovate via CircleCI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A CircleCI workflow, triggered weekly from the CircleCI web UI, that runs self-hosted Renovate to open a single grouped PR of minor/patch dependency updates (npm/pnpm + Dockerfile), majors held, with a 5-day cooldown, for manual merge.

**Architecture:** A `docker` executor runs the official `renovate/renovate` image as the job container. Renovate clones the repo itself via `RENOVATE_TOKEN`, reads a committed `renovate.json`, scans only the `npm` + `dockerfile` managers, groups every minor/patch update across both ecosystems into one branch (`chore/000/weekly-updates`), bumps `package.json` and refreshes `pnpm-lock.yaml`, and opens/force-refreshes one PR via the GitHub API plus a Dependency Dashboard issue. The whole workflow is gated behind a `workflow_type` pipeline parameter so it never collides with the existing branch/tag workflows. There is **no** custom code — all policy is declarative Renovate config.

**Tech Stack:** CircleCI 2.1 config, Renovate (`renovate/renovate` Docker image, pinned major), GitHub fine-grained PAT, pnpm 9 (driven by Renovate for lockfile refresh).

**Spec:** `docs/superpowers/specs/2026-06-30-circleci-renovate-design.md`

## Global Constraints

- **Husky commit hook:** `.husky/prepare-commit-msg` prepends `config: 000 - ` (from branch `config/000/integrate-dependabot`). Commit with **bare** messages — no type prefix, no ticket id. Correct: `git commit -m "add renovate config"`.
- **Strict equality only** in any JS: use `===` / `!==`, never `==` / `!=`. (This plan writes no JS.)
- **Executor for the Renovate job is the `docker` executor** running `renovate/renovate`, x86, `resource_class: medium`. Do **not** use `machine-executor` (that was a Dependabot-era constraint) and do **not** use `arm.*`.
- **Managers are an allowlist:** `enabledManagers: ["npm", "dockerfile"]` — Renovate must never touch `docker-compose*.yml`, `.circleci/config.yml`, `nvm`, or github-actions.
- **Range strategy is `bump`** — every update edits `package.json`; lockfile-only changes are forbidden.
- **One combined PR**, branch `chore/000/weekly-updates`, majors disabled (held, Dashboard-visible), `minimumReleaseAge: "5 days"`, `vulnerabilityAlerts` disabled, no auto-merge.
- **All policy lives in `renovate.json` at the repo root.** Only `RENOVATE_TOKEN` + `RENOVATE_REPOSITORIES` live in CircleCI env/context.
- **Repo slug:** `jianhong1998/maintenance-tracker`.

---

## File Structure

| File                                                                                                                                                               | Responsibility                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `renovate.json`                                                                                                                                                    | All Renovate policy: managers, grouping, majors held, cooldown, range strategy, branch prefix, platform commit, dashboard, security off. |
| `.circleci/config.yml`                                                                                                                                             | Add `parameters.workflow_type`, the `renovate` job, `renovate-workflow`, and the `not equal` gate on `branch-workflow`.                  |
| `.circleci/renovate/README.md`                                                                                                                                     | Manual setup steps (PAT, CircleCI context, Scheduled Pipeline) + operational notes.                                                      |
| _(deleted)_ `docs/superpowers/specs/2026-06-29-circleci-dependabot-design.md`, `docs/superpowers/plans/2026-06-29-circleci-dependabot.md`, `.circleci/dependabot/` | Superseded Dependabot design artifacts + empty dir.                                                                                      |

---

## Task 1: Renovate config (`renovate.json`) + schema validation + local dry-run

Produces the single source of policy and proves it parses and behaves before any CI wiring exists.

**Files:**

- Create: `renovate.json`

**Interfaces:**

- Produces: `renovate.json` at repo root, consumed implicitly by the `renovate` job (Task 2) and by Renovate's own clone during runs.

**Prerequisites (local machine):** Node 22 available (for `npx`); Docker running and a **read-only** GitHub PAT exported as `RENOVATE_TOKEN` for the dry-run only.

- [x] **Step 1: Write `renovate.json`**

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"],
  "dependencyDashboard": true,
  "enabledManagers": ["npm", "dockerfile"],
  "rangeStrategy": "bump",
  "platformCommit": "enabled",
  "branchPrefix": "chore/000/",
  "minimumReleaseAge": "5 days",
  "lockFileMaintenance": { "enabled": false },
  "vulnerabilityAlerts": { "enabled": false },
  "packageRules": [
    {
      "description": "Hold all major updates (visible on the Dashboard, no PR).",
      "matchUpdateTypes": ["major"],
      "enabled": false
    },
    {
      "description": "Collapse every minor/patch update across npm + docker into one PR.",
      "matchUpdateTypes": ["minor", "patch"],
      "groupName": "weekly-updates",
      "groupSlug": "weekly-updates"
    }
  ]
}
```

- [x] **Step 2: Validate the config against the Renovate schema**

Run: `npx --yes renovate-config-validator renovate.json`

Expected: `Validating renovate.json` followed by `Config validated successfully`. If it reports an unknown/renamed option (Renovate occasionally renames fields between majors — e.g. `platformCommit` accepting `"enabled"` vs a boolean in older versions), fix to the spelling the validator expects and re-run. Do **not** proceed with a failing validator.

- [ ] **Step 3: Local dry-run — verify behaviour without creating a PR**

Run (Docker must be running; `RENOVATE_TOKEN` = a **read-only** PAT):

```bash
docker run --rm \
  -e RENOVATE_TOKEN \
  -e RENOVATE_REPOSITORIES=jianhong1998/maintenance-tracker \
  -e RENOVATE_DRY_RUN=full \
  -e LOG_LEVEL=debug \
  -v "$PWD/renovate.json:/usr/src/app/renovate.json" \
  renovate/renovate:41
```

Inspect the log for all of:

- **Managers:** only `npm` and `dockerfile` are listed as enabled/extracted — **no** `docker-compose`, `circleci`, `nvm`, or `github-actions`.
- **Grouping:** a single branch `chore/000/weekly-updates` is planned (grouping collapses to one).
- **Majors held:** any major update appears as `update-type: major` and is reported as disabled/dashboard-only, **not** branched.
- **Range strategy:** the planned `package.json` edits show the constraint being raised (`bump`), not a lockfile-only change.
- **Cooldown:** a release younger than 5 days is reported as pending/blocked by `minimumReleaseAge`.
- **No PR created** (dry-run).

If managers other than npm/dockerfile appear, fix `enabledManagers`. If a lockfile-only edit appears, re-check `rangeStrategy: "bump"`.

> Note the image tag actually pulled (e.g. `renovate/renovate:41`) — reuse the **same** pinned tag in Task 2 so CI and the dry-run agree.

- [x] **Step 4: Commit**

```bash
git add renovate.json
git commit -m "add renovate config for weekly grouped minor/patch updates"
```

---

## Task 2: Wire the CircleCI config (parameter + renovate job + workflow + gate)

The "never break userspace" task. Adds the parameter, the job, the new workflow, and the single `not equal` gate to `branch-workflow`. Engine-independent gating, carried verbatim from the (superseded) Dependabot plan with renamed identifiers.

**Files:**

- Modify: `.circleci/config.yml`

**Interfaces:**

- Consumes: `renovate.json` (Task 1), the `renovate-context` CircleCI context (created manually, Task 3).
- Produces: the `workflow_type` parameter and `renovate-workflow` referenced by the Scheduled Pipeline (Task 3).

- [x] **Step 1: Add the top-level `parameters` block**

Insert immediately after `version: 2.1` (line 1), before the `# ===` Executors banner:

```yaml
version: 2.1

parameters:
  workflow_type:
    type: string
    default: ''
```

- [x] **Step 2: Add the `renovate` job**

Add to the `jobs:` map (e.g. after the `deploy-production` job, before the Workflows banner). The job _is_ a Renovate container; it overrides the image entrypoint to invoke `renovate` in a `run` step. No `checkout` — Renovate clones the repo itself.

```yaml
renovate:
  docker:
    - image: renovate/renovate:41
  resource_class: medium
  environment:
    RENOVATE_REPOSITORIES: jianhong1998/maintenance-tracker
    RENOVATE_PLATFORM: github
    LOG_LEVEL: info
  steps:
    - run:
        name: Run Renovate
        command: renovate
```

> Use the **same** pinned image tag observed in Task 1 Step 3. `RENOVATE_TOKEN` is supplied by the `renovate-context` (Step 4), not hardcoded here.

- [x] **Step 3: Gate the existing `branch-workflow`**

Change (around line 351):

```yaml
branch-workflow:
  when:
    equal: ['', << pipeline.git.tag >>]
  jobs:
```

to:

```yaml
branch-workflow:
  when:
    and:
      - equal: ['', << pipeline.git.tag >>]
      - not:
          equal: ['dependency-update', << pipeline.parameters.workflow_type >>]
  jobs:
```

- [x] **Step 4: Add `renovate-workflow`**

Add a new workflow under `workflows:` (e.g. after `branch-workflow`, before `tag-workflow`):

```yaml
renovate-workflow:
  when:
    equal: ['dependency-update', << pipeline.parameters.workflow_type >>]
  jobs:
    - renovate:
        context: renovate-context
```

- [x] **Step 5: Validate the config**

Run: `circleci config validate .circleci/config.yml`

Expected: `Config file at .circleci/config.yml is valid.`
(If the CircleCI CLI is missing: `brew install circleci`. `circleci config validate` validates structure locally without needing org access.)

- [x] **Step 6: Commit**

```bash
git add .circleci/config.yml
git commit -m "wire renovate job, workflow, and workflow_type gate"
```

---

## Task 3: Setup docs + remove superseded Dependabot artifacts

The code is inert until the PAT, context, and Scheduled Pipeline exist. Document them so they are reproducible, and delete the obsolete Dependabot design artifacts (nothing was implemented from them; the dir is empty).

**Files:**

- Create: `.circleci/renovate/README.md`
- Delete: `docs/superpowers/specs/2026-06-29-circleci-dependabot-design.md`
- Delete: `docs/superpowers/plans/2026-06-29-circleci-dependabot.md`
- Delete: `.circleci/dependabot/` (empty directory)

- [x] **Step 1: Write `.circleci/renovate/README.md`**

```markdown
# Self-hosted weekly Renovate (CircleCI)

Runs the Renovate CLI on a schedule and opens **one** grouped PR of minor/patch
updates for npm/pnpm + Dockerfiles. Majors are held (visible on the Dependency
Dashboard, no PR). New versions wait a 5-day cooldown. Manual merge.

See the design + plan:

- `docs/superpowers/specs/2026-06-30-circleci-renovate-design.md`
- `docs/superpowers/plans/2026-06-30-circleci-renovate.md`

## How it runs

`renovate-workflow` runs only when the pipeline parameter
`workflow_type == 'dependency-update'`. The `renovate` job is the official
`renovate/renovate` container; Renovate clones the repo itself via
`RENOVATE_TOKEN`, reads `renovate.json` at the repo root, and groups every
minor/patch update across the `npm` and `dockerfile` managers onto the fixed
branch `chore/000/weekly-updates`, opening/refreshing one PR via the GitHub API.

The branch is **force-refreshed every run** — always exactly one PR, never
accumulating. Do not commit manual fixes onto `chore/000/weekly-updates`; they
will be overwritten next run.

All policy lives in `renovate.json`. Only the token + target repo live in CircleCI.

## One-time setup

1. **GitHub PAT** — create a _fine-grained_ PAT scoped to this repo only:
   - Repository permissions: `Contents: Read and write`,
     `Pull requests: Read and write`, `Issues: Read and write` (Dependency Dashboard).
2. **CircleCI context** — create context `renovate-context` with env var
   `RENOVATE_TOKEN` = the PAT.
3. **Scheduled Pipeline** — Project Settings → Triggers → Add a scheduled trigger:
   - Target branch: `main`
   - Cadence: weekly (your chosen day/time)
   - Pipeline parameter: `workflow_type` = `dependency-update`
   - On-demand runs: use **Trigger Pipeline** with the same parameter.

## Cadence

CircleCI is the **only** cadence source. Renovate's own `schedule` is left unset
on purpose, so a run never silently no-ops outside an internal window. The 5-day
`minimumReleaseAge` only defers too-young versions to a later weekly run (shown
as "pending" on the Dashboard).

## Renovate image version

The job pins `renovate/renovate:41` (see `.circleci/config.yml`). Bump this tag
deliberately when adopting a new Renovate major; re-run the local dry-run from the
plan's Task 1 Step 3 after any bump.
```

- [x] **Step 2: Delete the superseded Dependabot artifacts**

```bash
git rm docs/superpowers/specs/2026-06-29-circleci-dependabot-design.md
git rm docs/superpowers/plans/2026-06-29-circleci-dependabot.md
rmdir .circleci/dependabot 2>/dev/null || true
```

(`.circleci/dependabot/` is an empty, untracked directory — `rmdir` removes it; the `|| true` keeps the step green if it is already gone.)

- [x] **Step 3: Commit the docs + deletions**

```bash
git add .circleci/renovate/README.md docs/superpowers/specs docs/superpowers/plans
git commit -m "document renovate setup and remove superseded dependabot design"
```

- [ ] **Step 4: Perform the external setup** (not code — do in the GitHub + CircleCI web UIs):
  - Create the fine-grained PAT (`Contents` + `Pull requests` + `Issues` R/W, this repo only).
  - Create the `renovate-context` with `RENOVATE_TOKEN`.
  - Create the weekly Scheduled Pipeline with `workflow_type=dependency-update`.

---

## Task 4: First live run validation

Proves the pipeline works end-to-end and — critically — that the existing pipeline is unaffected.

- [ ] **Step 1: Push the branch and open the integration PR**

```bash
git push -u origin config/000/integrate-dependabot
```

Confirm in CircleCI that the push ran **`branch-workflow` as normal** (lint/unit/ui) and did **not** run `renovate-workflow` — proves the default `workflow_type=''` path is intact.

- [ ] **Step 2: Trigger the renovate workflow on-demand**

In CircleCI: Trigger Pipeline on `main` (or the branch) with parameter `workflow_type=dependency-update`.

Expected:

- Only the `renovate` job runs; `branch-workflow` does **not**.
- The job completes; exactly one PR opens against `main` from `chore/000/weekly-updates`, titled `chore(deps): weekly minor/patch updates`.
- The PR contains only minor/patch bumps (no majors), spanning npm and/or Dockerfiles, and each bump edits **both** `package.json` and `pnpm-lock.yaml` (not lockfile-only).
- A **Dependency Dashboard** issue is created listing held majors / pending (too-young) updates.

- [ ] **Step 3: Verify idempotency**

Trigger the renovate workflow a second time.
Expected: the **same** PR is refreshed (force-updated) — no second PR is created.

- [ ] **Step 4: Confirm the opened PR's own CI**

The Renovate PR is a branch push → it runs `branch-workflow` (lint/unit/ui auto-run; build/deploy stay behind the `approve-build` gate). Confirm tests run and nothing auto-deploys.

- [ ] **Step 5: Merge the integration branch**

Once validated, merge `config/000/integrate-dependabot` (the config + `renovate.json` + docs) via its PR. The Scheduled Pipeline then runs weekly unattended.

---

## Self-Review (completed during planning)

**Spec coverage:**

- §2 scope (npm + dockerfile only, minor/patch, majors held, one PR, manual merge, 5-day cooldown, dashboard) → Task 1 (`renovate.json`); validated Task 1 Step 3 + Task 4 Step 2.
- §5 gating (param + `not equal` on branch-workflow + new `renovate-workflow`) → Task 2; correctness matrix exercised by Task 4 Steps 1–2.
- §6 trigger/cadence (Scheduled Pipeline, on-demand, Renovate schedule unset) → Task 3 Steps 1 + 4, Task 4 Step 2; README "Cadence".
- §7 config (`enabledManagers`, `rangeStrategy: bump`, `branchPrefix`, `platformCommit`, majors held, cooldown, security off) → Task 1 Step 1.
- §8 one combined PR (group → one branch, force-refresh) → Task 1 Step 1 packageRules; idempotency Task 4 Step 3.
- §9 credentials (single fine-grained PAT, `renovate-context`, Contents+PRs+Issues) → Task 3 Step 1 + Step 4.
- §10 risks (manager allowlist, lockfile-only, husky, vulnerabilityAlerts, schedule conflict) → Task 1 config + Task 1 Step 3 dry-run checks.
- §12 validation strategy → Task 1 (schema validate + dry-run), Task 2 (config validate), Task 4 (live).

**Identifier consistency:** context `renovate-context`, token env `RENOVATE_TOKEN`, repo `jianhong1998/maintenance-tracker`, branch `chore/000/weekly-updates`, group `weekly-updates`, image tag `renovate/renovate:41`, parameter value `dependency-update` are identical across `renovate.json` (Task 1), `config.yml` (Task 2), README (Task 3), and validation (Task 4).

**Placeholder scan:** no TBD/TODO; all config and commands are complete. The only value resolved empirically is the exact Renovate image tag (Task 1 Step 3), reused verbatim in Tasks 2–3; `41` is the documented default and is corrected to the actually-pulled tag if it differs.
