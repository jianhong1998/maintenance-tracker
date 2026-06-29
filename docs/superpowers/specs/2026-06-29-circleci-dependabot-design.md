# Self-Hosted Weekly Dependabot via CircleCI — Design

**Status:** Approved, ready for plan
**Date:** 2026-06-29
**Branch:** `config/000/integrate-dependabot`
**Source requirement:** Brainstorming session (no pre-existing raw-requirement doc). Originating ask: "configure a new pipeline workflow to run Dependabot for upgrading dependencies weekly, triggered from the CircleCI web UI."

---

## 1. Problem

The repo has no automated dependency-update mechanism. There is no `.github/dependabot.yml`, and GitHub-native Dependabot is intentionally **not** being used — the requirement is to run Dependabot as a **CircleCI-hosted job** so the schedule and trigger live in the CircleCI web UI alongside the rest of the pipeline.

"Self-hosted Dependabot" means we drive the open-source Dependabot engine ourselves instead of relying on GitHub's managed service. The engine finds outdated dependencies; **we** own the orchestration that turns its output into a pull request.

## 2. Scope

**In:**
- A new CircleCI workflow that runs Dependabot for **npm/pnpm** and **Docker** ecosystems.
- Triggered weekly by a **CircleCI Scheduled Pipeline** (created in the web UI) and on-demand via the same pipeline parameter.
- Restricted to **minor + patch** version updates; **major versions ignored**.
- All updates collapsed into **one single pull request** spanning both ecosystems.
- Manual merge — the runner only opens/refreshes the PR.

**Out:**
- GitHub-native Dependabot (`.github/dependabot.yml`).
- GitHub Actions and any ecosystem beyond npm + Docker.
- Major-version updates and security-only mode.
- Auto-merge of any kind.
- Per-ecosystem or per-dependency PRs.
- Updating image tags in `docker-compose*.yml` (Dependabot's `docker` ecosystem targets Dockerfiles).

## 3. Decisions (resolved during brainstorming)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Where Dependabot runs | Self-hosted in CircleCI (not GitHub-native) |
| 2 | Ecosystems | `npm_and_yarn` (pnpm) + `docker` |
| 3 | Update scope | All version updates, **minor + patch only**, majors ignored |
| 4 | Merge policy | Manual review, no auto-merge |
| 5 | Drive mechanism | Dependabot **CLI** orchestrating the **`dependabot-core` image** (not per-ecosystem slim images) + credential proxy |
| 6 | PR shape | **One combined PR** for npm + Docker, refreshed weekly |
| 7 | Credentials | **Single** fine-grained GitHub PAT in a CircleCI context |
| 8 | Executor | Existing **x86 `machine-executor`** (prebuilt Dependabot images are AMD64-only) |

## 4. Architecture

```
CircleCI Scheduled Pipeline (web UI, weekly)
        │  sets pipeline parameter run_dependabot=true
        ▼
dependabot-workflow  (when: run_dependabot == true)
        │
        ▼
dependabot job  (machine-executor, x86, Docker available)
   1. install `dependabot` CLI (Go binary)
   2. resolve main's HEAD SHA  → job source.commit
   3. dependabot update  -f job-npm.yml     → npm-output.yaml   ── via dependabot-core image + proxy
   4. dependabot update  -f job-docker.yml  → docker-output.yaml ── via dependabot-core image + proxy
   5. combiner: parse both outputs → one branch, one commit, one PR
```

- The CLI launches the **`dependabot-core` updater image** plus a **credential proxy** in sibling containers. All updater network traffic flows through the proxy, which injects the token into outbound requests so the updater container never holds the raw credential.
- `--updater-image` is pinned to `ghcr.io/dependabot/dependabot-core` per decision #5. **Implementation-time verification:** confirm the CLI accepts the monolithic `dependabot-core` image for both `npm_and_yarn` and `docker`; if the CLI requires the per-ecosystem `dependabot-updater-<eco>` images, fall back to those and record the deviation. This is a tooling detail, not an architecture change.
- Executor is the existing x86 `machine-executor` (`ubuntu-2204:current`). The ARM executors (`arm.large`, used by api-test/e2e) are **not** reused — prebuilt Dependabot images are AMD64 and run 2–3× slower under emulation on ARM.

## 5. CircleCI integration & no-breakage gating

This is the highest-risk part: a scheduled pipeline runs on `main` with no git tag, which today matches `branch-workflow`'s `when` condition. Without gating, the weekly Dependabot trigger would **also** fire lint/test/build/deploy.

**Add a pipeline parameter:**

```yaml
parameters:
  run_dependabot:
    type: boolean
    default: false
```

**Gate the existing `branch-workflow`** (change only its `when`):

```yaml
branch-workflow:
  when:
    and:
      - equal: ['', << pipeline.git.tag >>]
      - not: << pipeline.parameters.run_dependabot >>
```

**Add the new workflow:**

```yaml
dependabot-workflow:
  when: << pipeline.parameters.run_dependabot >>
  jobs:
    - dependabot:
        context: dependabot-context
```

**Correctness matrix** (proves "never break userspace"):

| Event | `git.tag` | `run_dependabot` | branch-workflow | tag-workflow | dependabot-workflow |
|-------|-----------|------------------|-----------------|--------------|---------------------|
| Normal branch push | `''` | `false` | ✅ runs (as today) | ✗ | ✗ |
| Semver tag push | set | `false` | ✗ | ✅ runs (as today) | ✗ |
| Scheduled / on-demand Dependabot | `''` | `true` | ✗ (gated off) | ✗ | ✅ runs |

`tag-workflow` is untouched. Normal pushes default `run_dependabot=false`, so `not false = true` and behaviour is identical to today.

## 6. Trigger

- The user creates a **Scheduled Pipeline** in the CircleCI web UI (Project → Triggers): weekly cadence (user's chosen day/time), target branch `main`, with pipeline parameter `run_dependabot: true`.
- On-demand "run now" uses the same parameter via the **Trigger Pipeline** button.
- **Nothing schedule-related lives in `config.yml`** — the config only defines the parameter and the workflow that responds to it. This matches the requirement that the trigger be handled in the CircleCI web UI.

## 7. Dependabot job descriptions

One job-description YAML per ecosystem, checked into `.circleci/dependabot/`. Both use a **catch-all group** restricted to minor/patch, and **ignore majors**.

**`job-npm.yml`** (shape — exact field names verified at implementation against the CLI model; `dependency-groups`, `allowed-updates`, `ignore-conditions` are confirmed present in `internal/model/job.go`):

```yaml
job:
  package-manager: npm_and_yarn
  source:
    provider: github
    repo: jianhong1998/maintenance-tracker
    directory: "/"          # root pnpm-lock.yaml covers all workspaces
    commit: <main HEAD sha> # injected at runtime
  allowed-updates:
    - update-type: all
  ignore-conditions:
    - dependency-name: "*"
      update-types: ["version-update:semver-major"]
  dependency-groups:
    - name: weekly-minor-patch
      applies-to: version-updates
      rules:
        patterns: ["*"]
        update-types: ["minor", "patch"]
```

**`job-docker.yml`** — identical structure with `package-manager: docker` and `directory: "/docker/deployment"` (location of `Dockerfile.backend`, `Dockerfile.frontend`, `Dockerfile.db-migration`).

Restricting to minor/patch is enforced **twice** (the group `update-types` and the global `ignore-conditions` on majors) so that even a dependency not matched by the group cannot produce a major-version change.

## 8. Combiner — one PR from two ecosystem runs

Dependabot has **no cross-ecosystem grouping** (groups only scope within one ecosystem, even in GitHub-native). So the single combined PR is ours to build. Each grouped run emits at most one `create_pull_request` record whose payload includes `updated-dependency-files` (path + content + operation). The combiner:

1. Parses both output files; collects every `updated-dependency-files` entry from the npm and docker runs.
2. If the combined set is empty → **do nothing** (no PR, leave any existing one alone).
3. Otherwise, against a **fixed long-lived branch** `dependabot/weekly-updates`:
   - Read `main`'s HEAD tree, overlay the updated file blobs, create a tree, create a commit (parent = `main` HEAD), **force-update** the branch ref to it (Git Data API).
   - If no open PR from that branch exists → open one targeting `main`, label `dependencies`, with a synthesized title (`chore(deps): weekly minor/patch updates`) and a body listing every bumped dependency (name, from → to) grouped by ecosystem.
   - If a PR is already open → the force-update refreshes it automatically; refresh the body to match.

**Fixed-branch + force-update + recompute-from-scratch each run** is what makes the cap unnecessary: there is always exactly one Dependabot PR, always reflecting the latest available minor/patch set, never accumulating. Unmerged weeks simply update the same PR.

**Structure for testability (good taste):** the combiner splits into a **pure core** — `buildCombinedUpdate(outputs) → { files, prTitle, prBody }` — and a **thin I/O shell** that performs the GitHub API calls. The pure core is unit-tested against captured output fixtures; the I/O shell is exercised by the first real run. Language: a small Node script (`.mjs`), matching the repo's Node toolchain. Test-runner wiring is a plan-level detail.

## 9. Credentials

- **One** fine-grained GitHub PAT, scoped to `jianhong1998/maintenance-tracker` only, permissions: `Contents: read & write` (branch + commit) and `Pull requests: read & write` (open/update PR). Nothing else.
- Stored in a new CircleCI **context** `dependabot-context` as `DEPENDABOT_GITHUB_TOKEN`. Never committed.
- The same token authenticates the compute step (via the proxy) and the combiner. The proxy isolates it from arbitrary code executed during dependency resolution (npm lifecycle scripts), which is why a single token is acceptable for a solo private repo.
- **Optional future hardening (out of scope):** split into a read-only compute job and a write create job, per `dependabot/example-cli-usage`.

## 10. Risks & back-compat

| Risk | Mitigation |
|------|------------|
| Scheduled run also fires the full build/deploy pipeline | `run_dependabot` parameter + `not` gate on `branch-workflow` (§5). Default `false` keeps normal pushes identical. |
| `dependabot-core` monolithic image incompatible with CLI `--updater-image` | Verify at implementation; fall back to `dependabot-updater-<eco>` images and record deviation (§4). |
| Job-description schema is not formally documented | Field names taken from the CLI's `internal/model/job.go`; validate by a local dry-run before wiring into CI (§12). |
| Token exposed to malicious dependency code during resolution | CLI proxy holds the credential; updater container never sees the raw token. Fine-grained PAT scoped to one repo limits blast radius. |
| Combined PR is all-or-nothing to merge | Accepted property (solo manual-merge flow). If one ecosystem's bump breaks CI, fix or drop it on the single branch. |
| AMD64-only images slow on ARM | Pin job to the x86 `machine-executor`. |
| Weekly PRs accumulate | Fixed branch + force-update means exactly one PR ever (§8). |
| pnpm workspace resolution | `npm_and_yarn` operates on root `/` where the single `pnpm-lock.yaml` lives; dependabot-core supports pnpm lockfiles. Verify in dry-run. |

## 11. File-change inventory

**New:**
- `.circleci/dependabot/job-npm.yml` — npm/pnpm job description.
- `.circleci/dependabot/job-docker.yml` — docker job description.
- `.circleci/dependabot/create-combined-pr.mjs` — combiner (pure core + I/O shell).
- `.circleci/dependabot/run.sh` — job entrypoint: install CLI, resolve HEAD sha, run both updates, invoke combiner.
- Combiner unit spec (path per plan-level test-runner decision).

**Modified:**
- `.circleci/config.yml` — add `parameters.run_dependabot`; add `dependabot` job; add `dependabot-workflow`; add the `not` gate to `branch-workflow.when`.

**External (manual, documented in plan — not code):**
- Create the fine-grained GitHub PAT.
- Create the CircleCI `dependabot-context` with `DEPENDABOT_GITHUB_TOKEN`.
- Create the weekly Scheduled Pipeline in the CircleCI web UI.

## 12. Validation strategy

CI config and shell glue are not unit-testable in the repo's Vitest sense, so verification is layered:

1. **Static:** `circleci config validate` on the edited `config.yml`.
2. **Local dry-run:** run `dependabot update -f job-npm.yml` (and docker) locally with a **read-only** token, inspecting output without creating PRs — confirms ecosystem support, grouping collapse to one PR, and major-ignore behaviour.
3. **Combiner unit tests:** pure `buildCombinedUpdate` tested against captured dry-run output fixtures (empty set, npm-only, docker-only, both).
4. **First live run observed:** trigger the pipeline on-demand (`run_dependabot=true`) and confirm exactly one PR opens against `main`, that it carries only minor/patch bumps, and that `branch-workflow` did **not** fire for the scheduled pipeline.

## 13. Non-goals / explicitly deferred

GitHub Actions ecosystem · grouping across ecosystems · auto-merge · major upgrades · security-only mode · two-token read/write split · docker-compose image bumps.
