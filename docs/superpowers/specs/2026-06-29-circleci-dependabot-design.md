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

| #   | Decision              | Choice                                                                                                              |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1   | Where Dependabot runs | Self-hosted in CircleCI (not GitHub-native)                                                                         |
| 2   | Ecosystems            | `npm_and_yarn` (pnpm) + `docker`                                                                                    |
| 3   | Update scope          | All version updates, **minor + patch only**, majors ignored                                                         |
| 4   | Merge policy          | Manual review, no auto-merge                                                                                        |
| 5   | Drive mechanism       | Dependabot **CLI** orchestrating the **`dependabot-core` image** (not per-ecosystem slim images) + credential proxy |
| 6   | PR shape              | **One combined PR** for npm + Docker, refreshed weekly                                                              |
| 7   | Credentials           | **Single** fine-grained GitHub PAT in a CircleCI context                                                            |
| 8   | Executor              | Existing **x86 `machine-executor`** (prebuilt Dependabot images are AMD64-only)                                     |

## 4. Architecture

```
CircleCI Scheduled Pipeline (web UI, weekly)
        │  sets pipeline parameter workflow_type=dependency-update
        ▼
dependabot-workflow  (when: workflow_type == 'dependency-update')
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
  workflow_type:
    type: string
    default: ''
```

A string parameter (rather than a boolean) so it can discriminate future workflow types, not just on/off. Normal pushes and tag releases never set it, so it defaults to `''`.

**Gate the existing `branch-workflow`** (change only its `when`):

```yaml
branch-workflow:
  when:
    and:
      - equal: ['', << pipeline.git.tag >>]
      - not:
          equal: ['dependency-update', << pipeline.parameters.workflow_type >>]
```

**Add the new workflow:**

```yaml
dependabot-workflow:
  when:
    equal: ['dependency-update', << pipeline.parameters.workflow_type >>]
  jobs:
    - dependabot:
        context: dependabot-context
```

**Correctness matrix** (proves "never break userspace"):

| Event                            | `git.tag` | `workflow_type`       | branch-workflow    | tag-workflow       | dependabot-workflow |
| -------------------------------- | --------- | --------------------- | ------------------ | ------------------ | ------------------- |
| Normal branch push               | `''`      | `''`                  | ✅ runs (as today) | ✗                  | ✗                   |
| Semver tag push                  | set       | `''`                  | ✗                  | ✅ runs (as today) | ✗                   |
| Scheduled / on-demand Dependabot | `''`      | `'dependency-update'` | ✗ (gated off)      | ✗                  | ✅ runs             |

`tag-workflow` is untouched. Normal pushes leave `workflow_type=''`, so the `not equal` test is true and `branch-workflow` behaves identically to today.

## 6. Trigger

- The user creates a **Scheduled Pipeline** in the CircleCI web UI (Project → Triggers): weekly cadence (user's chosen day/time), target branch `main`, with pipeline parameter `workflow_type: dependency-update`.
- On-demand "run now" sets the same `workflow_type: dependency-update` parameter via the **Trigger Pipeline** button.
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
    directory: '/' # root pnpm-lock.yaml covers all workspaces
    commit: <main HEAD sha> # injected at runtime
  allowed-updates:
    - update-type: all
  ignore-conditions:
    - dependency-name: '*'
      update-types: ['version-update:semver-major']
  dependency-groups:
    - name: weekly-minor-patch
      applies-to: version-updates
      rules:
        patterns: ['*']
        update-types: ['minor', 'patch']
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

| Risk                                                                       | Mitigation                                                                                                                               |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Scheduled run also fires the full build/deploy pipeline                    | `workflow_type` parameter + `not equal` gate on `branch-workflow` (§5). Default `''` keeps normal pushes identical.                      |
| `dependabot-core` monolithic image incompatible with CLI `--updater-image` | Verify at implementation; fall back to `dependabot-updater-<eco>` images and record deviation (§4).                                      |
| Job-description schema is not formally documented                          | Field names taken from the CLI's `internal/model/job.go`; validate by a local dry-run before wiring into CI (§12).                       |
| Token exposed to malicious dependency code during resolution               | CLI proxy holds the credential; updater container never sees the raw token. Fine-grained PAT scoped to one repo limits blast radius.     |
| Combined PR is all-or-nothing to merge                                     | Accepted property (solo manual-merge flow). If one ecosystem's bump breaks CI, fix or drop it on the single branch.                      |
| AMD64-only images slow on ARM                                              | Pin job to the x86 `machine-executor`.                                                                                                   |
| Weekly PRs accumulate                                                      | Fixed branch + force-update means exactly one PR ever (§8).                                                                              |
| pnpm workspace resolution                                                  | `npm_and_yarn` operates on root `/` where the single `pnpm-lock.yaml` lives; dependabot-core supports pnpm lockfiles. Verify in dry-run. |

## 11. File-change inventory

**New:**

- `.circleci/dependabot/job-npm.yml` — npm/pnpm job description.
- `.circleci/dependabot/job-docker.yml` — docker job description.
- `.circleci/dependabot/create-combined-pr.mjs` — combiner (pure core + I/O shell).
- `.circleci/dependabot/run.sh` — job entrypoint: install CLI, resolve HEAD sha, run both updates, invoke combiner.
- Combiner unit spec (path per plan-level test-runner decision).

**Modified:**

- `.circleci/config.yml` — add `parameters.workflow_type`; add `dependabot` job; add `dependabot-workflow`; add the `not equal` gate to `branch-workflow.when`.

**External (manual, documented in plan — not code):**

- Create the fine-grained GitHub PAT.
- Create the CircleCI `dependabot-context` with `DEPENDABOT_GITHUB_TOKEN`.
- Create the weekly Scheduled Pipeline in the CircleCI web UI.

## 12. Validation strategy

CI config and shell glue are not unit-testable in the repo's Vitest sense, so verification is layered:

1. **Static:** `circleci config validate` on the edited `config.yml`.
2. **Local dry-run:** run `dependabot update -f job-npm.yml` (and docker) locally with a **read-only** token, inspecting output without creating PRs — confirms ecosystem support, grouping collapse to one PR, and major-ignore behaviour.
3. **Combiner unit tests:** pure `buildCombinedUpdate` tested against captured dry-run output fixtures (empty set, npm-only, docker-only, both).
4. **First live run observed:** trigger the pipeline on-demand (`workflow_type=dependency-update`) and confirm exactly one PR opens against `main`, that it carries only minor/patch bumps, and that `branch-workflow` did **not** fire for the scheduled pipeline.

## 13. Non-goals / explicitly deferred

GitHub Actions ecosystem · grouping across ecosystems · auto-merge · major upgrades · security-only mode · two-token read/write split · docker-compose image bumps.

---

## Appendix A — Grilling session log (questions, answers, rationale)

This design was settled through a `/grill-me` + `/superpowers:brainstorming`
session: one question at a time, each with a recommended answer, walking the
decision tree. This log preserves what was asked, what was decided, and **why**
— including the cases where the chosen answer differed from the recommendation.

### Research that shaped the recommendations

Findings established before/between questions, used to ground the options:

- **GitHub-native Dependabot already does weekly PRs for free** (zero CI
  minutes, zero token management) — but its schedule lives in
  `.github/dependabot.yml`, so it **cannot** be triggered from the CircleCI
  web UI. This is the central tension behind Q1.
- **`dependabot-script` (the old self-hosting path) is deprecated**, now
  redirecting to `dependabot/example-cli-usage`. The supported standalone path
  is the **Dependabot CLI**, which produces update *diffs* (JSONL), not PRs;
  PR creation is wired up separately (`create.sh` in the example repo).
- **There is no official `:slim` image.** Dependabot publishes the monolithic
  `ghcr.io/dependabot/dependabot-core` and per-ecosystem
  `ghcr.io/dependabot/dependabot-updater-<eco>` images. The per-ecosystem ones
  *are* the "slim" images; the CLI pulls them by default.
- **Prebuilt images are AMD64-only** (run 2–3× slower on ARM under emulation)
  → forces the x86 `machine-executor` (Q via decision #8).
- **Grouping + major-ignoring are expressible in the CLI job-description YAML**
  (`dependency-groups`, `allowed-updates`, `ignore-conditions` exist in the
  CLI's `internal/model/job.go`). So "one grouped minor/patch PR, majors
  ignored" is *configuration*, not hand-built orchestration — this is what
  made Q5's answer cheap to honor.
- **Dependabot has no cross-ecosystem grouping** (groups only scope within one
  ecosystem, even in GitHub-native) → the single npm+Docker PR (follow-up a)
  requires a custom combiner; it is the one genuinely bespoke piece.

### Q1 — Where should Dependabot actually run?

- **Options:** (A) GitHub-native `.github/dependabot.yml` *(recommended)* — free, zero maintenance, but not CircleCI-triggerable. (B) Self-hosted in CircleCI — matches the literal request, ~10× the moving parts.
- **Recommendation:** A. For a solo project, don't build infrastructure GitHub already runs for free.
- **Decision:** **B — Self-hosted in CircleCI.**
- **Reason:** The requirement is explicitly that the schedule/trigger be handled in the CircleCI web UI, alongside the rest of the pipeline (single pane of glass). The user accepted the higher complexity and maintenance burden in exchange for keeping all automation in CircleCI. → Decision #1.

### Q2 — Which ecosystems?

- **Options:** npm/pnpm only *(recommended)* / npm + Docker / npm + Docker + GitHub Actions.
- **Recommendation:** npm/pnpm only — where nearly all churn and security risk lives; each extra ecosystem is more script surface in self-hosted mode.
- **Decision:** **npm + Docker.**
- **Reason:** Docker base images (`docker/deployment/Dockerfile.*`) are worth keeping current too; GitHub Actions moves slowly and was deferred. → Decision #2; GitHub Actions listed as a non-goal.

### Q3 — What happens to a PR once tests pass?

- **Options:** Manual review *(recommended)* / Auto-merge passing patch+minor / Auto-merge all passing.
- **Recommendation:** Manual review, no auto-merge.
- **Decision:** **Manual review.**
- **Reason:** Solo project with no second reviewer; auto-merge lets an unattended bad transitive bump reach `main`, and a green suite doesn't catch every regression. The cost of clicking merge on a green PR is trivial, and it's the least code to maintain. → Decision #4.

### Q4 — How are the Dependabot images driven?

Preceded by the user's note: *"I will prefer to use Dependabot slim docker image to run it"* — which surfaced the research that there is no official slim tag (the per-ecosystem images are the slim ones).

- **Options:** (X) CLI orchestrates the images + credential proxy *(recommended, supported `example-cli-usage` path)* / (Y) run the updater image directly as the job container (deprecated `dependabot-script` style, no proxy isolation).
- **Recommendation:** X.
- **Decision:** **X — CLI-orchestrated — but using the monolithic `dependabot-core` image instead of the per-ecosystem slim images.**
- **Reason:** X is the supported path and keeps proxy credential isolation; the user preferred the broader `dependabot-core` image over fussing with per-ecosystem variants. Caveat recorded: the CLI defaults to per-ecosystem images, so `dependabot-core` likely requires pinning `--updater-image` and must be verified at implementation, with the per-ecosystem images as the proven fallback. → Decision #5, §4 implementation-time verification, §10 risk.

### Q5 — How to control PR volume?

- **Options:** Cap at 5 open PRs *(recommended, mirrors GitHub's default)* / Cap at a different number / No cap.
- **Recommendation:** Cap at 5 — one PR per dependency floods otherwise, and unmerged PRs accumulate weekly.
- **Decision (differed from all options):** **Create exactly one grouped PR for all minor + patch upgrades; ignore major upgrades for now.**
- **Reason:** Grouping minimizes review noise far better than a cap (≈1 PR per ecosystem per run instead of many), and it's cheap because grouping + major-ignoring are pure job-YAML configuration (see research above), not orchestration. Majors are deferred as inherently higher-risk and worth handling deliberately. → Decisions #3 (minor/patch only, majors ignored) and #6 (one combined PR); makes the cap moot.

### Follow-up (a) — One combined PR, or one per ecosystem?

Raised when presenting the design: the natural unit is one grouped PR *per ecosystem* (npm + Docker = 2 PRs), because the two ecosystems are separate updater runs touching different files.

- **Decision:** **Literally one PR, combining npm + Docker.**
- **Reason:** The user wants the absolute minimum PR count (one). Consequence accepted and recorded: Dependabot has no cross-ecosystem grouping, so this requires a **custom combiner** (we own the code), and the PR becomes **all-or-nothing to merge** — if one ecosystem's bump breaks CI, it's fixed or dropped on the single branch rather than merged independently. → Decision #6, §8, §10 risk.

### Follow-up (b) — Credential model

The user asked what "single-PAT model" meant.

- **Clarification given:** one fine-grained PAT (scoped to this repo, `Contents` + `Pull requests` read/write) used by both the compute step (via the proxy, which isolates it from arbitrary code run during dependency resolution) and the PR-creation step — versus the `example-cli-usage` two-token read/write split, which is unnecessary for a solo private repo because the proxy already protects the token.
- **Decision:** **Single fine-grained PAT** in CircleCI context `dependabot-context`. Two-token split listed as optional future hardening. → Decision #7, §9.

### Follow-up (c) — Trigger gating parameter

After spec approval, the user requested the pipeline only trigger on a pipeline param `workflow_type='dependency-update'`.

- **Decision:** Use a **string** parameter `workflow_type` (default `''`) rather than a boolean `run_dependabot`. `dependabot-workflow` runs on `equal ['dependency-update', workflow_type]`; `branch-workflow` gains a `not equal` guard on the same value.
- **Reason:** A string discriminator is extensible to future web-UI-triggered workflow types without adding more boolean flags or touching this gate again, and it keeps the change to `branch-workflow` surgical (one `not equal` clause). Normal pushes and tag releases never set it, so behaviour is unchanged. → §5, §6.
