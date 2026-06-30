# Self-Hosted Weekly Renovate via CircleCI — Design

**Status:** Approved, ready for plan
**Date:** 2026-06-30
**Branch:** `config/000/integrate-dependabot`
**Supersedes:** `2026-06-29-circleci-dependabot-design.md`. We pivoted from
self-hosted Dependabot to **Renovate** because Renovate collapses almost all of
the bespoke machinery the Dependabot design required — the custom cross-ecosystem
combiner, the credential proxy, and the AMD64-only `machine-executor` pin all
disappear. Renovate creates and groups PRs natively, runs as a single multi-arch
container, and expresses every policy as declarative config. The _policy_
decisions (npm + Docker, minor/patch only, majors ignored, one combined PR,
manual merge, CircleCI-triggered) carry over unchanged; only the engine and its
supporting code change.

---

## 1. Problem

The repo has no automated dependency-update mechanism. GitHub-native Dependabot
is intentionally **not** used — the requirement is to drive dependency updates as
a **CircleCI-hosted job** so the schedule and trigger live in the CircleCI web UI
alongside the rest of the pipeline (single pane of glass).

"Self-hosted Renovate" means we run the open-source Renovate engine ourselves in
CI instead of as a hosted GitHub App. Renovate finds outdated dependencies **and**
owns the full PR lifecycle (branch, commit, open, refresh) — we only own the
declarative config and the CircleCI wiring that invokes it.

## 2. Scope

**In:**

- A new CircleCI workflow that runs Renovate for **npm/pnpm** and **Dockerfile**
  ecosystems.
- Triggered weekly by a **CircleCI Scheduled Pipeline** (created in the web UI)
  and on-demand via the same pipeline parameter.
- Restricted to **minor + patch** version updates; **major versions disabled**
  (but visible on the Dependency Dashboard).
- A **5-day cooldown** (`minimumReleaseAge`) — a new version is not proposed until
  it has been published for at least 5 days.
- Every update **bumps `package.json`** (the version constraint) and refreshes
  `pnpm-lock.yaml` — never a lockfile-only change.
- All updates collapsed into **one single pull request** spanning both ecosystems.
- Manual merge — Renovate only opens/refreshes the PR.
- A **Dependency Dashboard** issue for visibility into held majors / pending
  (too-young) updates / run errors.

**Out:**

- GitHub-native Dependabot / Renovate hosted GitHub App.
- Any manager beyond `npm` + `dockerfile` — explicitly **not** `docker-compose`,
  `github-actions`, `nvm`, or the `circleci` manager (Renovate must not rewrite
  `.circleci/config.yml` or `docker-compose*.yml`).
- Major-version updates and security-only mode.
- `vulnerabilityAlerts` (Renovate's separate, off-model security PRs) — **disabled**.
- Auto-merge of any kind.
- Per-ecosystem or per-dependency PRs.

## 3. Decisions (resolved during the grilling session — see Appendix A)

| #   | Decision         | Choice                                                                                                       |
| --- | ---------------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | Engine           | Self-hosted **Renovate** in CircleCI (replaces self-hosted Dependabot). Native grouping + PR lifecycle.      |
| 2   | Managers         | `enabledManagers: ["npm", "dockerfile"]` only — auto-detection of all other managers suppressed              |
| 3   | Update scope     | minor + patch only; majors `enabled: false` (held, visible on Dashboard)                                     |
| 4   | Cooldown         | `minimumReleaseAge: "5 days"` (default `internalChecksFilter: "flexible"` — `strict` suppressed branch creation for the grouped PR) |
| 5   | Range strategy   | `rangeStrategy: "bump"` — always edit `package.json` then refresh lockfile; never lockfile-only              |
| 6   | PR shape         | **One combined grouped PR** for npm + Docker, force-refreshed each run                                       |
| 7   | Merge policy     | Manual review, no auto-merge                                                                                 |
| 8   | Branch naming    | `branchPrefix: "chore/000/"` → branches like `chore/000/weekly-updates` (satisfies the husky branch pattern) |
| 9   | Commit mechanism | `platformCommit: "enabled"` — commits via GitHub API (verified commits; sidesteps the husky commit hook)     |
| 10  | Commit/PR text   | Renovate's default conventional-commits format; PR title `chore(deps): weekly minor/patch updates`           |
| 11  | Security PRs     | `vulnerabilityAlerts: { enabled: false }` — preserves the one-PR / no-majors / cooldown guarantees           |
| 12  | Dashboard        | Dependency Dashboard **on** (one tracking issue; needs `Issues: R/W` on the PAT)                             |
| 13  | Executor         | `docker` executor running the official `renovate/renovate` image (multi-arch, no DinD, `medium`, x86)        |
| 14  | Credentials      | **Single** fine-grained GitHub PAT in CircleCI context `renovate-context` as `RENOVATE_TOKEN`                |
| 15  | Cadence source   | CircleCI Scheduled Pipeline only; Renovate's internal `schedule` left unset (always-allowed)                 |
| 16  | Config location  | Committed `renovate.json` at repo root holds all policy; only token/repo wiring lives in CircleCI env        |

## 4. Architecture

```
CircleCI Scheduled Pipeline (web UI, weekly)
        │  sets pipeline parameter workflow_type=dependency-update
        ▼
renovate-workflow  (when: workflow_type == 'dependency-update')
        │
        ▼
renovate job  (docker executor: renovate/renovate image, x86, medium)
   1. read RENOVATE_TOKEN + RENOVATE_REPOSITORIES from renovate-context
   2. run `renovate` — it clones the repo itself (no CircleCI `checkout`)
   3. Renovate reads renovate.json, scans npm + dockerfile managers
   4. groups all minor/patch into one branch `chore/000/weekly-updates`
   5. bumps package.json + refreshes pnpm-lock.yaml via pnpm (in-process)
   6. opens/force-refreshes one PR via GitHub API; updates Dependency Dashboard
```

- Renovate runs **as the job container** (`docker` executor, image
  `renovate/renovate:<pinned>`). It clones the repo itself via `RENOVATE_TOKEN`,
  so no CircleCI `checkout` step is needed.
- **No Docker daemon / DinD:** the `dockerfile` manager resolves base-image tags
  via HTTP registry lookups; the `npm` manager refreshes the lockfile by running
  pnpm in-process. Neither needs a Docker socket.
- The official image is **multi-arch** and bundles the toolchain (node, pnpm via
  corepack), so the AMD64-only constraint that forced the Dependabot design onto
  `machine-executor` is gone. A `medium` x86 `docker` executor is cheaper and
  simpler than the previous `machine-executor`.
- **No custom combiner, no credential proxy, no `run.sh`.** Renovate's native
  cross-manager grouping produces the single combined PR; the GitHub token is the
  only credential and Renovate consumes it directly.

## 5. CircleCI integration & no-breakage gating

This is the highest-risk part and is **unchanged in shape** from the Dependabot
design — gating is engine-independent. A scheduled pipeline runs on `main` with no
git tag, which today matches `branch-workflow`'s `when`. Without gating, the weekly
Renovate trigger would **also** fire lint/test/build/deploy.

**Add a pipeline parameter:**

```yaml
parameters:
  workflow_type:
    type: string
    default: ''
```

A string parameter (rather than a boolean) so it can discriminate future workflow
types. Normal pushes and tag releases never set it, so it defaults to `''`.

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
renovate-workflow:
  when:
    equal: ['dependency-update', << pipeline.parameters.workflow_type >>]
  jobs:
    - renovate:
        context: renovate-context
```

**Correctness matrix** (proves "never break userspace"):

| Event                          | `git.tag` | `workflow_type`       | branch-workflow    | tag-workflow       | renovate-workflow |
| ------------------------------ | --------- | --------------------- | ------------------ | ------------------ | ----------------- |
| Normal branch push             | `''`      | `''`                  | ✅ runs (as today) | ✗                  | ✗                 |
| Semver tag push                | set       | `''`                  | ✗                  | ✅ runs (as today) | ✗                 |
| Scheduled / on-demand Renovate | `''`      | `'dependency-update'` | ✗ (gated off)      | ✗                  | ✅ runs           |

`tag-workflow` is untouched. Normal pushes leave `workflow_type=''`, so the
`not equal` test is true and `branch-workflow` behaves identically to today.

**Renovate's own PR intentionally runs `branch-workflow`.** When Renovate pushes
`chore/000/weekly-updates`, that is a normal branch push (`workflow_type=''`), so
`branch-workflow` runs lint/unit/ui on the dependency PR (build/deploy stay behind
the existing `approve-build` gate). `renovate-workflow` does **not** re-fire on
that push, so there is no loop. This is the desired validation of the bumps.

## 6. Trigger & cadence

- The user creates a **Scheduled Pipeline** in the CircleCI web UI
  (Project → Triggers): weekly cadence (user's chosen day/time), target branch
  `main`, with pipeline parameter `workflow_type: dependency-update`.
- On-demand "run now" sets the same `workflow_type: dependency-update` parameter
  via the **Trigger Pipeline** button.
- **Nothing schedule-related lives in `config.yml` or `renovate.json`.** Renovate's
  own `schedule` field is deliberately left **unset** (always-allowed) so the
  CircleCI Scheduled Pipeline is the single source of cadence. If Renovate's
  internal schedule were set and a CircleCI run fired outside its window, the run
  would silently no-op.
- The 5-day `minimumReleaseAge` cooldown is **orthogonal** to cadence: a version
  younger than 5 days at run time is simply deferred to a later weekly run and is
  shown as "pending" on the Dependency Dashboard.

## 7. Renovate configuration (`renovate.json`)

One committed `renovate.json` at the repo root holds **all** policy. Operational
wiring (token, target repo) stays in CircleCI env. Field names below are stable
Renovate options; exact spelling verified at implementation against the Renovate
config docs.

```jsonc
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
      "enabled": false,
    },
    {
      "description": "Collapse every minor/patch update across npm + docker into one PR.",
      "matchUpdateTypes": ["minor", "patch"],
      "groupName": "weekly-updates",
      "groupSlug": "weekly-updates",
    },
  ],
}
```

- `enabledManagers` is an **allowlist** reproducing the in-scope set exactly; every
  other manager Renovate would otherwise auto-detect (docker-compose, github-actions,
  nvm, circleci) stays off (§2).
- `rangeStrategy: "bump"` guarantees `package.json` is edited even for an in-range
  minor/patch bump (the repo uses caret ranges, where Renovate's default `replace`
  would otherwise produce a **lockfile-only** change — see Appendix A, Q4).
- The two `packageRules` are order-independent: majors are disabled regardless of
  ecosystem; everything minor/patch lands in the single `weekly-updates` group.
- `branchPrefix: "chore/000/"` makes the group branch `chore/000/weekly-updates`,
  which satisfies the husky branch-name pattern `^(chore|…)/[0-9]+/.+$`.
  `platformCommit: "enabled"` additionally commits via the GitHub API, so the
  husky `prepare-commit-msg` hook never runs on Renovate commits and cannot reject
  them.

## 8. One combined PR — for free

Renovate has native cross-manager grouping: a single `groupName` matching
`["minor","patch"]` across the enabled managers produces **one branch, one PR**.
The branch is **rebased / force-refreshed every run**, so there is always exactly
one Renovate PR, always reflecting the latest eligible minor/patch set, never
accumulating. Unmerged weeks simply update the same PR. This is the same property
the Dependabot design built a ~400-line custom combiner to achieve; under Renovate
it is default behavior expressed in two `packageRules`.

## 9. Credentials

- **One** fine-grained GitHub PAT, scoped to `jianhong1998/maintenance-tracker`
  only, permissions: **`Contents: read & write`** (branch + commit),
  **`Pull requests: read & write`** (open/refresh PR), **`Issues: read & write`**
  (Dependency Dashboard). Nothing else.
- Stored in a new CircleCI **context** `renovate-context` as `RENOVATE_TOKEN`.
  Never committed.
- The single token authenticates clone, commit (via the GitHub API under
  `platformCommit`), PR, and Dashboard. A single token is acceptable for a solo
  private repo; Renovate runs package managers with scripts ignored by default
  during lockfile refresh, limiting the blast radius of malicious dependency code.
- Public npm registry and `node` Docker Hub lookups are unauthenticated and fine
  at this volume. **Implementation-time note:** if Docker Hub rate-limits the
  `minimumReleaseAge` timestamp lookups, add a `hostRules` entry with a Docker Hub
  token — not expected for a single base image.

## 10. Risks & back-compat

| Risk                                                                   | Mitigation                                                                                                               |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Scheduled run also fires the full build/deploy pipeline                | `workflow_type` parameter + `not equal` gate on `branch-workflow` (§5). Default `''` keeps normal pushes identical.      |
| Renovate auto-enables managers beyond scope (docker-compose, circleci) | `enabledManagers: ["npm","dockerfile"]` allowlist (§7). Renovate never touches `.circleci/config.yml` or compose files.  |
| Default `rangeStrategy` produces lockfile-only updates on caret ranges | `rangeStrategy: "bump"` forces a `package.json` edit on every bump (§7, Appendix A Q4).                                  |
| Husky hook rejects Renovate's branch/commit                            | `branchPrefix: "chore/000/"` satisfies the branch pattern; `platformCommit: "enabled"` commits via API, bypassing husky. |
| Security advisory spawns an off-model extra PR (major / <5 days old)   | `vulnerabilityAlerts: { enabled: false }` (§2, Appendix A Q9). Dashboard still surfaces held updates.                    |
| Renovate's internal schedule conflicts with CircleCI cadence           | Renovate `schedule` left unset; CircleCI Scheduled Pipeline is the only cadence source (§6).                             |
| Combined PR is all-or-nothing to merge                                 | Accepted property (solo manual-merge flow). If one bump breaks CI, fix or drop it on the single branch.                  |
| Docker Hub rate limits on age lookups                                  | Add `hostRules` Docker Hub token if observed; not expected for one base image (§9).                                      |
| pnpm workspace resolution                                              | `npm` manager operates on the root `pnpm-lock.yaml` covering all workspaces; Renovate supports pnpm workspaces (§7).     |

## 11. File-change inventory

**New:**

- `renovate.json` — all Renovate policy (managers, grouping, majors, cooldown,
  range strategy, branch prefix, dashboard).
- `.circleci/renovate/README.md` — manual setup steps (PAT, CircleCI context,
  Scheduled Pipeline) + operational notes.

**Modified:**

- `.circleci/config.yml` — add `parameters.workflow_type`; add the `renovate`
  job; add `renovate-workflow`; add the `not equal` gate to `branch-workflow.when`.

**Deleted:**

- `docs/superpowers/specs/2026-06-29-circleci-dependabot-design.md`
- `docs/superpowers/plans/2026-06-29-circleci-dependabot.md`
- `.circleci/dependabot/` (empty directory)

**External (manual, documented in plan — not code):**

- Create the fine-grained GitHub PAT (`Contents` + `Pull requests` + `Issues` R/W).
- Create the CircleCI `renovate-context` with `RENOVATE_TOKEN`.
- Create the weekly Scheduled Pipeline in the CircleCI web UI with
  `workflow_type=dependency-update`.

## 12. Validation strategy

CI config and the Renovate run are not unit-testable in the repo's Vitest sense,
so verification is layered:

1. **Static:** `circleci config validate .circleci/config.yml`; validate
   `renovate.json` against the Renovate JSON schema
   (`npx --yes renovate-config-validator renovate.json`).
2. **Local dry-run:** run the Renovate image with `LOG_LEVEL=debug` and
   `RENOVATE_DRY_RUN=full` against the repo using a **read-only** PAT — confirms
   manager detection (npm + dockerfile only), grouping collapse to one branch,
   major-hold, the 5-day cooldown behaviour, and that `package.json` is edited
   (not lockfile-only). No branch/PR is created in dry-run.
3. **First live run observed:** trigger the pipeline on-demand
   (`workflow_type=dependency-update`) and confirm exactly one PR opens against
   `main` from `chore/000/weekly-updates`, that it carries only minor/patch bumps
   editing both `package.json` and `pnpm-lock.yaml`, that the Dependency Dashboard
   issue appears, and that `branch-workflow` did **not** fire for the scheduled
   pipeline.

## 13. Non-goals / explicitly deferred

GitHub Actions / docker-compose / circleci managers · auto-merge · major upgrades ·
security-only mode (`vulnerabilityAlerts`) · hosted Renovate App · per-dependency
PRs · two-token split.

---

## Appendix A — Grilling session log (questions, answers, rationale)

This design was settled in a `/grill-me` session: one question at a time, each
with a recommended answer, walking the decision tree. The session began from the
prior (approved) self-hosted-Dependabot design and the user's instruction to "use
Renovate instead." This log preserves what was asked, what was decided, and **why**.

### Framing — what the Renovate swap deletes

The central realization: Renovate is **not** an engine swap inside the Dependabot
architecture — it collapses the architecture. The Dependabot design's ~400 lines of
bespoke machinery (`combine.mjs`, `create-combined-pr.mjs`, `run.sh`, fixtures,
two test files, the credential proxy, the x86-only `machine-executor` pin) existed
_only_ to work around Dependabot's limitations:

- The custom combiner existed only because **Dependabot has no cross-ecosystem
  grouping**. Renovate groups across managers natively.
- The credential proxy existed only because the Dependabot CLI orchestrates a
  separate updater container. Renovate consumes the token directly.
- The x86 pin existed only because prebuilt Dependabot images are AMD64-only.
  `renovate/renovate` is multi-arch and needs no Docker daemon.

**Decision:** delete the entire combiner/proxy/`run.sh` layer; Renovate owns
grouping and the PR lifecycle natively. All _policy_ decisions carry over.

### Q1 — Branch naming vs the husky hook

`.husky/prepare-commit-msg` validates branch names on `git commit` against
`^(chore|feat|fix|bugfix|docs|style|refactor|test|build|ci|perf|revert|config|plan)/[0-9]+/.+$`.
Renovate self-hosted against GitHub with a PAT **defaults to committing locally
with `git`**, so if husky is active in Renovate's clone, a default `renovate/...`
branch fails the pattern and the commit dies. So matching the pattern is defensive,
not cosmetic.

- **Decision:** `branchPrefix: "chore/000/"` (branch `chore/000/weekly-updates`),
  plus `platformCommit: "enabled"` so commits go through the GitHub API and husky
  never runs. `chore` because dependency bumps are conventionally `chore(deps)`;
  `000` is the repo's no-ticket convention. → Decisions #8, #9.

### Q2 — Cooldown

- **Decision:** `minimumReleaseAge: "5 days"` with the default
  `internalChecksFilter: "flexible"`. A too-young release is held back per-package
  and rolls into the grouped PR as it ages. **`internalChecksFilter: "strict"` was
  removed** — combined with the single 60+ package `weekly-updates` group it
  suppressed branch creation entirely (under `strict` the branch is not created
  while *any* group member's `renovate/stability-days` check is pending, which for
  a large weekly group is effectively always). The 5-day soak still applies; we
  just no longer block the whole branch on it. → Decision #4.

### Q3 — How Renovate runs in CircleCI

- **Options:** (A) `docker` executor running `renovate/renovate` directly
  _(recommended)_ / (B) `machine-executor` + `docker run` / (C) `node-executor` +
  `npx renovate`.
- **Decision:** **A.** Renovate clones the repo itself, no DinD (the dockerfile
  manager uses HTTP registry lookups; npm refresh runs pnpm in-process), multi-arch
  image, `medium` x86 — cheaper and simpler than the Dependabot `machine-executor`.
  → Decision #13.

### Q4 — Forbidding lockfile-only updates

The repo uses **caret ranges** (`^11.0.1`, `^9.1.7`, …). Renovate's default
`rangeStrategy: "auto"` → `replace` for caret ranges only edits `package.json` when
the new version falls _outside_ the range; a minor/patch bump stays in range and
produces a **lockfile-only** change — exactly what the user forbids.

- **Decision:** `rangeStrategy: "bump"` — always raise the constraint in
  `package.json`, then refresh the lockfile via pnpm. `lockFileMaintenance` kept
  disabled (the other lockfile-only vector). The few exact-pinned deps
  (`axios: 1.14.0`) are replaced in place; internal `workspace:*` deps are ignored.
  → Decision #5.

### Q5 — Restricting managers (scope preservation)

Renovate **auto-detects and enables every manager** by default — on this repo it
would also manage `docker-compose` (explicitly out of scope), the `circleci`
manager (would rewrite `.circleci/config.yml` executor images), `nvm`, and
`github-actions`.

- **Decision:** `enabledManagers: ["npm", "dockerfile"]` — an allowlist reproducing
  the original in-scope set exactly. → Decision #2.

### Q6 — Dependency Dashboard / major visibility

Majors stay disabled (`matchUpdateTypes: ["major"] → enabled: false`). Renovate's
Dependency Dashboard is a single _issue_ (not a PR), so it does not violate the
one-PR rule, and it makes the held majors **visible** (with a manual "trigger now"
checkbox) instead of silently invisible as under Dependabot's "ignore."

- **Decision:** Dashboard **on**; PAT gains `Issues: R/W`. → Decisions #3, #12.

### Q7 — Credentials

- **Decision:** one fine-grained PAT scoped to the repo with `Contents` +
  `Pull requests` + `Issues` R/W, in CircleCI context `renovate-context` as
  `RENOVATE_TOKEN`, plus `RENOVATE_REPOSITORIES=jianhong1998/maintenance-tracker`.
  → Decision #14.

### Q8 — CircleCI gating (carry-over)

- **Decision:** carry the `workflow_type` parameter + `not equal` gate on
  `branch-workflow` + new `renovate-workflow` verbatim from the Dependabot design.
  Renovate's internal `schedule` left **unset** so CircleCI is the sole cadence
  source; Renovate's PR push **intentionally** runs `branch-workflow` to validate
  the bumps (no loop, since that push has `workflow_type=''`). → Decisions #1, #15.

### Q9 — `vulnerabilityAlerts`

Renovate enables `vulnerabilityAlerts` by default; a security advisory then opens
a **separate** PR that bypasses grouping, `minimumReleaseAge`, and the major block
— breaking the one-PR / no-majors / cooldown guarantees. The original spec listed
security-only mode as out of scope.

- **Decision:** `vulnerabilityAlerts: { enabled: false }`. The Dashboard preserves
  visibility; can be flipped on later as a deliberate choice. → Decision #11.

### Q10 — Commit / PR text

Because `platformCommit` bypasses husky, the message format is fully Renovate's.

- **Decision:** keep Renovate's default conventional-commits format; PR title
  `chore(deps): weekly minor/patch updates`. → Decision #10.

### Q11 — Docs + config location

- **Decision:** write this fresh renovate-named spec + plan, **delete** the
  Dependabot spec/plan and the empty `.circleci/dependabot/` dir (git history
  preserves them). Put all policy in a committed `renovate.json` at the repo root;
  only token/repo wiring stays in CircleCI env. → Decision #16.
