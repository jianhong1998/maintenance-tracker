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
