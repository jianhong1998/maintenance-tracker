# Self-Hosted Weekly Dependabot via CircleCI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A CircleCI workflow, triggered weekly from the CircleCI web UI, that opens a single grouped PR of minor/patch dependency updates (npm/pnpm + Docker), majors ignored, for manual merge.

**Architecture:** A `machine-executor` (x86) job installs the Dependabot CLI, runs it against the locally-checked-out repo for the `npm_and_yarn` and `docker` ecosystems (each configured to group all minor/patch updates and ignore majors), and feeds the JSONL output to a small Node combiner that collapses both ecosystems' file changes onto one fixed branch (`dependabot/weekly-updates`) and opens/refreshes one PR via the GitHub REST API. The whole workflow is gated behind a `workflow_type` pipeline parameter so it never collides with the existing branch/tag workflows.

**Tech Stack:** CircleCI 2.1 config, Dependabot CLI `v1.90.0` (Go binary, runs `dependabot-core` updater + proxy via Docker), Node 22 (ESM, `node:test`, global `fetch`), bash.

**Spec:** `docs/superpowers/specs/2026-06-29-circleci-dependabot-design.md`

## Global Constraints

- **Husky commit hook:** `.husky/prepare-commit-msg` prepends `config: 000 - ` (from branch `config/000/integrate-dependabot`). Commit with **bare** messages — no type prefix, no ticket id. Correct: `git commit -m "add npm job description"`.
- **Strict equality only:** use `===` / `!==`, never `==` / `!=`.
- **Functions with >2 params take a single object param** (project convention). The functions here take one arg, so this is already satisfied.
- **Executor must be x86** (`machine-executor` = `ubuntu-2204:current`). Prebuilt Dependabot images are AMD64-only; the ARM executors run them 2–3× slower under emulation. Do **not** use `arm.*` classes.
- **Node version:** 22 (repo `engines.node >= 22`).
- **Token env var for the CLI is `LOCAL_GITHUB_ACCESS_TOKEN`** (the CLI passes it to the proxy). The combiner reads the same PAT from `DEPENDABOT_GITHUB_TOKEN`.
- **All new files live under `.circleci/dependabot/`.**
- **Node test files are named `*.test.mjs`** (so `node --test` discovers them) and use only `node:test` + `node:assert` — no Vitest, no npm deps.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `.circleci/dependabot/job-npm.yml` | Dependabot job description for `npm_and_yarn`: group all minor/patch, ignore majors. |
| `.circleci/dependabot/job-docker.yml` | Same for `docker`, directory `/docker/deployment`. |
| `.circleci/dependabot/combine.mjs` | **Pure** logic: JSONL → `{files, title, body, baseSha, hasUpdates, branch}`. No I/O. |
| `.circleci/dependabot/combine.test.mjs` | `node:test` unit tests for `combine.mjs`. |
| `.circleci/dependabot/create-combined-pr.mjs` | **I/O shell:** read JSONL files → call `buildCombinedUpdate` → git branch/commit/force-push + PR via REST. Honors `DRY_RUN`. |
| `.circleci/dependabot/create-combined-pr.test.mjs` | `node:test` test driving the shell in `DRY_RUN` mode against fixtures. |
| `.circleci/dependabot/fixtures/*.jsonl` | Small schema-accurate synthetic fixtures for the two test files. |
| `.circleci/dependabot/run.sh` | Job entrypoint: install CLI, run both updates, invoke combiner. |
| `.circleci/dependabot/README.md` | Manual setup steps (PAT, CircleCI context, Scheduled Pipeline). |
| `.circleci/config.yml` | Add `parameters.workflow_type`, the `dependabot` job, `dependabot-workflow`, and the gate on `branch-workflow`. |

---

## Task 1: Dependabot job descriptions + local dry-run + capture fixtures

Validates the two job YAMLs by producing real grouped output locally, and resolves the open `--updater-image` question (does the monolithic `dependabot-core` image work, or must we use the default per-ecosystem images?).

**Files:**
- Create: `.circleci/dependabot/job-npm.yml`
- Create: `.circleci/dependabot/job-docker.yml`

**Interfaces:**
- Produces: two job-description files consumed by `run.sh` (Task 4) and the JSONL output schema consumed by `combine.mjs` (Task 2).

**Prerequisites (local machine):** Docker running; the Dependabot CLI installed; a **read-only** GitHub PAT exported as `LOCAL_GITHUB_ACCESS_TOKEN` for the dry-run only.

- [ ] **Step 1: Install the Dependabot CLI locally**

```bash
# macOS (local dev). CI installs the linux build itself in Task 4.
brew install dependabot   # or: go install github.com/dependabot/cli/cmd/dependabot@v1.90.0
dependabot --version
```

- [ ] **Step 2: Write `.circleci/dependabot/job-npm.yml`**

```yaml
job:
  package-manager: npm_and_yarn
  source:
    provider: github
    repo: jianhong1998/maintenance-tracker
    directory: '/'
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

- [ ] **Step 3: Write `.circleci/dependabot/job-docker.yml`**

```yaml
job:
  package-manager: docker
  source:
    provider: github
    repo: jianhong1998/maintenance-tracker
    directory: '/docker/deployment'
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

- [ ] **Step 4: Dry-run npm against the local checkout, capturing output**

Run from repo root (must be on an up-to-date `main`):

```bash
LOCAL_GITHUB_ACCESS_TOKEN="$READONLY_PAT" \
  dependabot update -f .circleci/dependabot/job-npm.yml --local . --timeout 20m \
  > /tmp/result-npm.jsonl || true
```

Expected: completes; `/tmp/result-npm.jsonl` contains at least one line with `"type":"create_pull_request"` whose `data.dependencies` are **only minor/patch** bumps. Inspect:

```bash
grep '"type":"create_pull_request"' /tmp/result-npm.jsonl \
  | node -e 'process.stdin.on("data",d=>d.toString().trim().split("\n").forEach(l=>{const o=JSON.parse(l);console.log(o.data.dependencies?.map(x=>x.name))}))'
```

Expected: a single grouped `create_pull_request` (grouping collapses to one), no major bumps.

- [ ] **Step 5: Dry-run docker the same way**

```bash
LOCAL_GITHUB_ACCESS_TOKEN="$READONLY_PAT" \
  dependabot update -f .circleci/dependabot/job-docker.yml --local . --timeout 20m \
  > /tmp/result-docker.jsonl || true
```

Expected: completes; Docker base-image minor/patch bumps only (or zero `create_pull_request` lines if nothing is outdated — that is a valid result).

- [ ] **Step 6: Resolve the `--updater-image` question**

Re-run Step 4 adding `--updater-image ghcr.io/dependabot/dependabot-core:latest`.

```bash
LOCAL_GITHUB_ACCESS_TOKEN="$READONLY_PAT" \
  dependabot update -f .circleci/dependabot/job-npm.yml --local . --timeout 20m \
  --updater-image ghcr.io/dependabot/dependabot-core:latest > /dev/null || true
```

- If it succeeds → record `UPDATER_IMAGE=ghcr.io/dependabot/dependabot-core:latest` for Task 5.
- If it fails (the CLI expects per-ecosystem `dependabot-updater-<eco>` images) → record `UPDATER_IMAGE=` (empty = CLI default) and note the deviation in the PR description. **Do not block on this** — the default images are the proven path; the user's `dependabot-core` preference is best-effort.

Write the outcome into `.circleci/dependabot/README.md` later (Task 6).

- [ ] **Step 7: Commit the job descriptions**

```bash
git add .circleci/dependabot/job-npm.yml .circleci/dependabot/job-docker.yml
git commit -m "add dependabot job descriptions for npm and docker"
```

---

## Task 2: Combiner pure core (`combine.mjs`) — TDD

The testable heart: parse one-or-more ecosystems' JSONL into a single combined PR payload.

**Files:**
- Create: `.circleci/dependabot/combine.mjs`
- Test: `.circleci/dependabot/combine.test.mjs`
- Create: `.circleci/dependabot/fixtures/npm-sample.jsonl`, `.circleci/dependabot/fixtures/docker-sample.jsonl`, `.circleci/dependabot/fixtures/empty.jsonl`

**Interfaces:**
- Produces: `export function buildCombinedUpdate(sources)` where
  `sources: Array<{ ecosystem: string, jsonl: string }>` →
  `{ files: Array<{ path: string, content: string, deleted: boolean }>, title: string, body: string, baseSha: string | null, hasUpdates: boolean, branch: string }`.
  Also `export const FIXED_BRANCH` and `export const PR_TITLE`.
- Consumes: the Dependabot CLI JSONL schema — lines of `{ type, data }`; for `type === 'create_pull_request'`, `data` has `base-commit-sha`, `pr-title`, `pr-body`, `commit-message`, `updated-dependency-files[]` (`{ directory, name, content, deleted }`), `dependencies[]` (`{ name, version }`).

- [ ] **Step 1: Write the fixtures**

`.circleci/dependabot/fixtures/npm-sample.jsonl` (one line):

```json
{"type":"create_pull_request","data":{"base-commit-sha":"aaaa111","pr-title":"Bump npm deps","pr-body":"body","commit-message":"bump","updated-dependency-files":[{"directory":"/","name":"package.json","content":"{\"x\":1}","deleted":false},{"directory":"/","name":"pnpm-lock.yaml","content":"lock-v2","deleted":false}],"dependencies":[{"name":"left-pad","version":"1.3.1"},{"name":"zod","version":"3.23.8"}]}}
```

`.circleci/dependabot/fixtures/docker-sample.jsonl` (one line):

```json
{"type":"create_pull_request","data":{"base-commit-sha":"aaaa111","pr-title":"Bump docker","pr-body":"body","commit-message":"bump","updated-dependency-files":[{"directory":"/docker/deployment","name":"Dockerfile.backend","content":"FROM node:22.15","deleted":false}],"dependencies":[{"name":"node","version":"22.15"}]}}
```

`.circleci/dependabot/fixtures/empty.jsonl` (one line — a progress record, no PR):

```json
{"type":"update_dependency_list","data":{"dependencies":[]}}
```

- [ ] **Step 2: Write the failing tests**

`.circleci/dependabot/combine.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildCombinedUpdate, FIXED_BRANCH, PR_TITLE } from './combine.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fx = (n) => readFileSync(join(here, 'fixtures', n), 'utf8');

test('empty input → no updates', () => {
  const r = buildCombinedUpdate([{ ecosystem: 'npm', jsonl: fx('empty.jsonl') }]);
  assert.equal(r.hasUpdates, false);
  assert.deepEqual(r.files, []);
});

test('npm only → files and deps captured', () => {
  const r = buildCombinedUpdate([{ ecosystem: 'npm', jsonl: fx('npm-sample.jsonl') }]);
  assert.equal(r.hasUpdates, true);
  assert.equal(r.baseSha, 'aaaa111');
  assert.deepEqual(
    r.files.map((f) => f.path).sort(),
    ['package.json', 'pnpm-lock.yaml'],
  );
  assert.match(r.body, /left-pad/);
  assert.match(r.body, /zod/);
});

test('both ecosystems → merged files, body grouped by ecosystem', () => {
  const r = buildCombinedUpdate([
    { ecosystem: 'npm', jsonl: fx('npm-sample.jsonl') },
    { ecosystem: 'docker', jsonl: fx('docker-sample.jsonl') },
  ]);
  assert.deepEqual(
    r.files.map((f) => f.path).sort(),
    ['docker/deployment/Dockerfile.backend', 'package.json', 'pnpm-lock.yaml'],
  );
  assert.match(r.body, /### npm/);
  assert.match(r.body, /### docker/);
  assert.equal(r.title, PR_TITLE);
  assert.equal(r.branch, FIXED_BRANCH);
});

test('same path in two entries → last wins (dedup)', () => {
  const a = '{"type":"create_pull_request","data":{"base-commit-sha":"s","updated-dependency-files":[{"directory":"/","name":"package.json","content":"OLD","deleted":false}],"dependencies":[]}}';
  const b = '{"type":"create_pull_request","data":{"base-commit-sha":"s","updated-dependency-files":[{"directory":"/","name":"package.json","content":"NEW","deleted":false}],"dependencies":[]}}';
  const r = buildCombinedUpdate([{ ecosystem: 'npm', jsonl: `${a}\n${b}` }]);
  assert.equal(r.files.length, 1);
  assert.equal(r.files[0].content, 'NEW');
});

test('deleted file flagged', () => {
  const line = '{"type":"create_pull_request","data":{"base-commit-sha":"s","updated-dependency-files":[{"directory":"/","name":"gone.json","content":"","deleted":true}],"dependencies":[]}}';
  const r = buildCombinedUpdate([{ ecosystem: 'npm', jsonl: line }]);
  assert.equal(r.files[0].deleted, true);
});

test('non-JSON lines are skipped', () => {
  const jsonl = `not json\n${fx('npm-sample.jsonl')}\n   `;
  const r = buildCombinedUpdate([{ ecosystem: 'npm', jsonl }]);
  assert.equal(r.hasUpdates, true);
});
```

- [ ] **Step 3: Run the tests — verify they fail**

Run: `node --test .circleci/dependabot/combine.test.mjs`
Expected: FAIL — `Cannot find module './combine.mjs'` (file not created yet).

- [ ] **Step 4: Implement `.circleci/dependabot/combine.mjs`**

```js
// Pure logic: parse Dependabot CLI JSONL output from one or more ecosystems
// into a single combined pull-request payload. No I/O — fully unit-testable.

export const FIXED_BRANCH = 'dependabot/weekly-updates';
export const PR_TITLE = 'chore(deps): weekly minor/patch updates';

const normalizePath = (directory, name) =>
  `${directory ?? '/'}/${name ?? ''}`
    .replace(/\/+/g, '/')
    .replace(/^\/+/, '');

const buildBody = (depsByEcosystem) => {
  if (depsByEcosystem.size === 0) {
    return 'No dependency updates found.';
  }
  const lines = ['Automated weekly minor/patch dependency updates.', ''];
  for (const [ecosystem, names] of depsByEcosystem) {
    lines.push(`### ${ecosystem}`);
    for (const n of [...new Set(names)].sort()) {
      lines.push(`- ${n}`);
    }
    lines.push('');
  }
  lines.push('Major version updates are intentionally excluded.');
  return lines.join('\n');
};

export function buildCombinedUpdate(sources) {
  const fileMap = new Map(); // path → { path, content, deleted }
  const depsByEcosystem = new Map(); // ecosystem → string[]
  let baseSha = null;

  for (const { ecosystem, jsonl } of sources) {
    for (const line of jsonl.split('\n')) {
      const trimmed = line.trim();
      if (trimmed === '') continue;

      let obj;
      try {
        obj = JSON.parse(trimmed);
      } catch {
        continue; // skip progress logs / non-JSON noise
      }
      if (obj.type !== 'create_pull_request') continue;

      const data = obj.data ?? {};
      if (baseSha === null && typeof data['base-commit-sha'] === 'string') {
        baseSha = data['base-commit-sha'];
      }

      for (const f of data['updated-dependency-files'] ?? []) {
        const path = normalizePath(f.directory, f.name);
        fileMap.set(path, {
          path,
          content: f.content ?? '',
          deleted: Boolean(f.deleted),
        });
      }

      const names = (data.dependencies ?? [])
        .map((d) => d.name)
        .filter((n) => typeof n === 'string' && n !== '');
      if (names.length > 0) {
        const existing = depsByEcosystem.get(ecosystem) ?? [];
        depsByEcosystem.set(ecosystem, existing.concat(names));
      }
    }
  }

  const files = [...fileMap.values()];
  return {
    files,
    title: PR_TITLE,
    body: buildBody(depsByEcosystem),
    baseSha,
    hasUpdates: files.length > 0,
    branch: FIXED_BRANCH,
  };
}
```

- [ ] **Step 5: Run the tests — verify they pass**

Run: `node --test .circleci/dependabot/combine.test.mjs`
Expected: PASS — all 6 tests pass.

- [ ] **Step 6: Commit**

```bash
git add .circleci/dependabot/combine.mjs .circleci/dependabot/combine.test.mjs .circleci/dependabot/fixtures/
git commit -m "add combiner pure core with tests"
```

---

## Task 3: Combiner I/O shell (`create-combined-pr.mjs`) — TDD via DRY_RUN

Wraps the pure core with git + GitHub REST side effects. Tested in `DRY_RUN` mode so it never touches a real repo or the network.

**Files:**
- Create: `.circleci/dependabot/create-combined-pr.mjs`
- Test: `.circleci/dependabot/create-combined-pr.test.mjs`

**Interfaces:**
- Consumes: `buildCombinedUpdate` from `combine.mjs`; CLI args of the form `ecosystem:path.jsonl`; env `DEPENDABOT_GITHUB_TOKEN`, `GITHUB_REPOSITORY` (`owner/repo`), `BASE_BRANCH` (default `main`), `DRY_RUN` (any non-empty value logs instead of executing).
- Produces: a runnable script invoked by `run.sh` (Task 4). In `DRY_RUN` it prints `GIT …`, `WRITE …`, and `API …` lines and exits 0.

- [ ] **Step 1: Write the failing test**

`.circleci/dependabot/create-combined-pr.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, 'create-combined-pr.mjs');
const fxArg = (eco, n) => `${eco}:${join(here, 'fixtures', n)}`;

const runDry = (args) =>
  execFileSync('node', [script, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      DRY_RUN: '1',
      DEPENDABOT_GITHUB_TOKEN: 'x',
      GITHUB_REPOSITORY: 'jianhong1998/maintenance-tracker',
      BASE_BRANCH: 'main',
    },
  });

test('no updates → reports nothing to do, no git/API actions', () => {
  const out = runDry([fxArg('npm', 'empty.jsonl')]);
  assert.match(out, /nothing to do/i);
  assert.doesNotMatch(out, /^API /m);
});

test('updates → plans branch, writes, commit, push, and opens a PR', () => {
  const out = runDry([fxArg('npm', 'npm-sample.jsonl'), fxArg('docker', 'docker-sample.jsonl')]);
  assert.match(out, /GIT checkout -B dependabot\/weekly-updates/);
  assert.match(out, /WRITE package\.json/);
  assert.match(out, /WRITE docker\/deployment\/Dockerfile\.backend/);
  assert.match(out, /GIT commit/);
  assert.match(out, /GIT push --force/);
  assert.match(out, /API GET .*\/pulls\?head=/);
  assert.match(out, /API POST .*\/pulls\b/);
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `node --test .circleci/dependabot/create-combined-pr.test.mjs`
Expected: FAIL — script does not exist yet (`Cannot find module …create-combined-pr.mjs`).

- [ ] **Step 3: Implement `.circleci/dependabot/create-combined-pr.mjs`**

```js
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname } from 'node:path';
import { buildCombinedUpdate } from './combine.mjs';

const DRY_RUN = Boolean(process.env.DRY_RUN);
const TOKEN = process.env.DEPENDABOT_GITHUB_TOKEN ?? '';
const REPO = process.env.GITHUB_REPOSITORY ?? '';
const BASE = process.env.BASE_BRANCH ?? 'main';

const parseArgs = (argv) =>
  argv.map((a) => {
    const idx = a.indexOf(':');
    return { ecosystem: a.slice(0, idx), file: a.slice(idx + 1) };
  });

const git = (args) => {
  if (DRY_RUN) {
    console.log('GIT', args.join(' '));
    return '';
  }
  return execFileSync('git', args, { encoding: 'utf8' });
};

const api = async (method, path, body) => {
  if (DRY_RUN) {
    console.log('API', method, `https://api.github.com${path}`);
    return Array.isArray(body) ? [] : { number: 0 };
  }
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${method} ${path} → ${res.status} ${await res.text()}`);
  }
  return res.json();
};

const main = async () => {
  const sources = parseArgs(process.argv.slice(2)).map(({ ecosystem, file }) => ({
    ecosystem,
    jsonl: readFileSync(file, 'utf8'),
  }));

  const result = buildCombinedUpdate(sources);
  if (!result.hasUpdates) {
    console.log('No dependency updates found — nothing to do.');
    return;
  }

  const base = result.baseSha ?? BASE;
  git(['config', 'user.email', 'dependabot-bot@users.noreply.github.com']);
  git(['config', 'user.name', 'dependabot-bot']);
  git(['checkout', '-B', result.branch, base]);

  for (const f of result.files) {
    if (f.deleted) {
      git(['rm', '-f', '--ignore-unmatch', '--', f.path]);
    } else {
      if (DRY_RUN) {
        console.log('WRITE', f.path);
      } else {
        mkdirSync(dirname(f.path), { recursive: true });
        writeFileSync(f.path, f.content);
      }
      git(['add', '--', f.path]);
    }
  }

  git(['commit', '-m', result.title]);
  const remote = DRY_RUN ? '<remote>' : `https://x-access-token:${TOKEN}@github.com/${REPO}.git`;
  git(['push', '--force', remote, result.branch]);

  const owner = REPO.split('/')[0];
  const open = await api('GET', `/repos/${REPO}/pulls?head=${owner}:${result.branch}&state=open`);
  if (Array.isArray(open) && open.length > 0) {
    await api('PATCH', `/repos/${REPO}/pulls/${open[0].number}`, {
      title: result.title,
      body: result.body,
    });
    console.log(`Refreshed PR #${open[0].number}`);
  } else {
    const pr = await api('POST', `/repos/${REPO}/pulls`, {
      title: result.title,
      body: result.body,
      head: result.branch,
      base: BASE,
    });
    await api('POST', `/repos/${REPO}/issues/${pr.number}/labels`, {
      labels: ['dependencies'],
    });
    console.log(`Opened PR #${pr.number}`);
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 4: Run the test — verify it passes**

Run: `node --test .circleci/dependabot/create-combined-pr.test.mjs`
Expected: PASS — both tests pass.

- [ ] **Step 5: Run the full combiner test suite**

Run: `node --test .circleci/dependabot/`
Expected: PASS — all tests across `combine.test.mjs` and `create-combined-pr.test.mjs`.

- [ ] **Step 6: Commit**

```bash
git add .circleci/dependabot/create-combined-pr.mjs .circleci/dependabot/create-combined-pr.test.mjs
git commit -m "add combiner io shell with dry-run tests"
```

---

## Task 4: Job entrypoint (`run.sh`)

Ties CLI install + both update runs + the combiner into one script the CircleCI job calls.

**Files:**
- Create: `.circleci/dependabot/run.sh`

**Interfaces:**
- Consumes: env `DEPENDABOT_GITHUB_TOKEN` (from the CircleCI context), optional `UPDATER_IMAGE` (from Task 1 Step 6), `GITHUB_REPOSITORY`, `BASE_BRANCH`. Calls `create-combined-pr.mjs`.
- Produces: the command run by the `dependabot` CircleCI job (Task 5).

- [ ] **Step 1: Write `.circleci/dependabot/run.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

DEPENDABOT_CLI_VERSION="v1.90.0"
UPDATER_IMAGE="${UPDATER_IMAGE:-}" # empty → CLI default per-ecosystem images

install_cli() {
  local tarball="dependabot-${DEPENDABOT_CLI_VERSION}-linux-amd64.tar.gz"
  curl -fsSL \
    "https://github.com/dependabot/cli/releases/download/${DEPENDABOT_CLI_VERSION}/${tarball}" \
    -o "/tmp/${tarball}"
  tar -xzf "/tmp/${tarball}" -C /tmp dependabot
  sudo mv /tmp/dependabot /usr/local/bin/dependabot
  dependabot --version
}

run_update() {
  local job_file="$1" out_file="$2"
  local img_flag=()
  if [ -n "$UPDATER_IMAGE" ]; then
    img_flag=(--updater-image "$UPDATER_IMAGE")
  fi
  LOCAL_GITHUB_ACCESS_TOKEN="$DEPENDABOT_GITHUB_TOKEN" \
    dependabot update \
    -f "$job_file" \
    --local . \
    --timeout 20m \
    "${img_flag[@]}" \
    >>"$out_file" || true
}

install_cli

: >result-npm.jsonl
: >result-docker.jsonl
run_update .circleci/dependabot/job-npm.yml result-npm.jsonl
run_update .circleci/dependabot/job-docker.yml result-docker.jsonl

node .circleci/dependabot/create-combined-pr.mjs \
  npm:result-npm.jsonl \
  docker:result-docker.jsonl
```

- [ ] **Step 2: Make it executable and lint it**

```bash
chmod +x .circleci/dependabot/run.sh
shellcheck .circleci/dependabot/run.sh
```

Expected: `shellcheck` exits 0 (no warnings). If `shellcheck` is not installed: `brew install shellcheck`.

- [ ] **Step 3: Smoke-test the combiner wiring with DRY_RUN (no Docker/CLI needed)**

Temporarily verify the `node …` tail using the committed fixtures, to confirm arg wiring:

```bash
DRY_RUN=1 DEPENDABOT_GITHUB_TOKEN=x GITHUB_REPOSITORY=jianhong1998/maintenance-tracker \
  node .circleci/dependabot/create-combined-pr.mjs \
  npm:.circleci/dependabot/fixtures/npm-sample.jsonl \
  docker:.circleci/dependabot/fixtures/docker-sample.jsonl
```

Expected: prints `GIT …`, `WRITE …`, `API POST …/pulls`, exits 0.

- [ ] **Step 4: Commit**

```bash
git add .circleci/dependabot/run.sh
git commit -m "add dependabot job entrypoint script"
```

---

## Task 5: Wire the CircleCI config (parameter + job + workflow + gate)

The "never break userspace" task. Adds the parameter, the job, the new workflow, and the single-line gate to `branch-workflow`.

**Files:**
- Modify: `.circleci/config.yml`

**Interfaces:**
- Consumes: `run.sh` (Task 4), the `dependabot-context` CircleCI context (created manually, Task 6).
- Produces: the `workflow_type` parameter and `dependabot-workflow` referenced by the Scheduled Pipeline (Task 6).

- [ ] **Step 1: Add the top-level `parameters` block**

Insert immediately after `version: 2.1` (line 1), before the `# ===` Executors banner:

```yaml
version: 2.1

parameters:
  workflow_type:
    type: string
    default: ''
```

- [ ] **Step 2: Add the `dependabot` job**

Add to the `jobs:` map (e.g. after the `deploy-production` job, before the Workflows banner):

```yaml
  dependabot:
    executor: machine-executor
    resource_class: medium
    environment:
      GITHUB_REPOSITORY: jianhong1998/maintenance-tracker
      BASE_BRANCH: main
      # UPDATER_IMAGE set per Task 1 Step 6 outcome; leave unset for CLI default images.
    steps:
      - checkout
      - run:
          name: Ensure Node 22
          command: |
            nvm install 22
            nvm alias default 22
            node --version
      - run:
          name: Run Dependabot and open combined PR
          command: bash .circleci/dependabot/run.sh
```

> If Task 1 Step 6 found `dependabot-core` works, add `UPDATER_IMAGE: ghcr.io/dependabot/dependabot-core:latest` under `environment:`. Otherwise leave it commented out.

- [ ] **Step 3: Gate the existing `branch-workflow`**

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

- [ ] **Step 4: Add `dependabot-workflow`**

Add a new workflow under `workflows:` (e.g. after `branch-workflow`, before `tag-workflow`):

```yaml
  dependabot-workflow:
    when:
      equal: ['dependency-update', << pipeline.parameters.workflow_type >>]
    jobs:
      - dependabot:
          context: dependabot-context
```

- [ ] **Step 5: Validate the config**

```bash
circleci config validate .circleci/config.yml
```

Expected: `Config file at .circleci/config.yml is valid.`
(If the CircleCI CLI is missing: `brew install circleci`. If it requires a token for org-context lookups, `circleci config validate` still validates structure locally.)

- [ ] **Step 6: Commit**

```bash
git add .circleci/config.yml
git commit -m "wire dependabot job, workflow, and workflow_type gate"
```

---

## Task 6: Manual setup documentation + external resources

The code is inert until the PAT, context, and Scheduled Pipeline exist. These are manual web-UI / GitHub steps — document them so they are reproducible, then perform them.

**Files:**
- Create: `.circleci/dependabot/README.md`

- [ ] **Step 1: Write `.circleci/dependabot/README.md`**

```markdown
# Self-hosted weekly Dependabot (CircleCI)

Runs the Dependabot CLI on a schedule and opens **one** grouped PR of
minor/patch updates for npm/pnpm + Docker. Majors are ignored. Manual merge.

See the design + plan:
- `docs/superpowers/specs/2026-06-29-circleci-dependabot-design.md`
- `docs/superpowers/plans/2026-06-29-circleci-dependabot.md`

## How it runs

`dependabot-workflow` runs only when the pipeline parameter
`workflow_type == 'dependency-update'`. `run.sh` installs the CLI, runs
`dependabot update` for each ecosystem against the checked-out repo, and
`create-combined-pr.mjs` collapses both ecosystems' changes onto the fixed
branch `dependabot/weekly-updates` and opens/refreshes one PR.

The branch is **force-updated every run** — always exactly one PR, never
accumulating. Do not commit manual fixes onto `dependabot/weekly-updates`;
they will be overwritten next run.

## One-time setup

1. **GitHub PAT** — create a *fine-grained* PAT scoped to this repo only:
   - Repository permissions: `Contents: Read and write`, `Pull requests: Read and write`.
2. **CircleCI context** — create context `dependabot-context` with env var
   `DEPENDABOT_GITHUB_TOKEN` = the PAT.
3. **Scheduled Pipeline** — Project Settings → Triggers → Add a scheduled
   trigger:
   - Target branch: `main`
   - Cadence: weekly (your chosen day/time)
   - Pipeline parameter: `workflow_type` = `dependency-update`
   - On-demand runs: use **Trigger Pipeline** with the same parameter.

## Updater image

`UPDATER_IMAGE` in the `dependabot` job selects the updater container.
Default (unset) uses the CLI's per-ecosystem `dependabot-updater-<eco>`
images. <!-- Record Task 1 Step 6 result here: whether dependabot-core works. -->
```

- [ ] **Step 2: Record the Task 1 Step 6 updater-image outcome** in the README's "Updater image" section (replace the HTML comment with the finding).

- [ ] **Step 3: Commit the docs**

```bash
git add .circleci/dependabot/README.md
git commit -m "document dependabot self-hosting setup"
```

- [ ] **Step 4: Perform the external setup** (not code — do in the GitHub + CircleCI web UIs):
  - Create the fine-grained PAT.
  - Create the `dependabot-context` with `DEPENDABOT_GITHUB_TOKEN`.
  - Create the weekly Scheduled Pipeline with `workflow_type=dependency-update`.

---

## Task 7: First live run validation

Proves the pipeline works end-to-end and — critically — that the existing pipeline is unaffected.

- [ ] **Step 1: Push the branch and open the integration PR**

```bash
git push -u origin config/000/integrate-dependabot
```

Confirm in CircleCI that the push ran **`branch-workflow` as normal** (lint/unit/ui) and did **not** run `dependabot-workflow` — proves the default `workflow_type=''` path is intact.

- [ ] **Step 2: Trigger the dependabot workflow on-demand**

In CircleCI: Trigger Pipeline on `main` (or the branch) with parameter `workflow_type=dependency-update`.

Expected:
- Only the `dependabot` job runs; `branch-workflow` does **not**.
- The job completes; exactly one PR opens against `main` from `dependabot/weekly-updates`, labelled `dependencies`, titled `chore(deps): weekly minor/patch updates`.
- The PR contains only minor/patch bumps (no majors), spanning npm and/or Docker.

- [ ] **Step 3: Verify idempotency**

Trigger the dependabot workflow a second time.
Expected: the **same** PR is refreshed (force-updated) — no second PR is created.

- [ ] **Step 4: Confirm the opened PR's own CI**

The Dependabot PR is a branch push → it runs `branch-workflow` (lint/unit/ui auto-run; build/deploy stay behind the `approve-build` gate). Confirm tests run and nothing auto-deploys.

- [ ] **Step 5: Merge the integration branch**

Once validated, merge `config/000/integrate-dependabot` (the config + scripts) via its PR. The Scheduled Pipeline then runs weekly unattended.

---

## Self-Review (completed during planning)

**Spec coverage:**
- §2 scope (npm + docker, minor/patch, majors ignored, one PR, manual merge) → Tasks 1–3.
- §5 gating (param + `not equal` on branch-workflow + new workflow) → Task 5; correctness matrix exercised by Task 7 Steps 1–2.
- §6 trigger (Scheduled Pipeline, on-demand) → Task 6 Step 4, Task 7 Step 2.
- §7 job descriptions (grouping, ignore majors, directories) → Task 1.
- §8 combiner (fixed branch, force-update, one PR, empty-set no-op, pure core + I/O shell) → Tasks 2–3.
- §9 credentials (single fine-grained PAT, `dependabot-context`) → Task 6.
- §10 risks (updater-image compatibility, AMD64 executor) → Task 1 Step 6, Task 5 Step 2.
- §12 validation strategy → Tasks 1 (dry-run), 2–3 (unit), 5 (config validate), 7 (live).

**Type consistency:** `buildCombinedUpdate` shape (`files`/`title`/`body`/`baseSha`/`hasUpdates`/`branch`) is identical in Task 2 (definition), Task 2 tests, and Task 3 consumer. Token env names consistent: CLI uses `LOCAL_GITHUB_ACCESS_TOKEN`, combiner/push use `DEPENDABOT_GITHUB_TOKEN`, both fed the same PAT.

**Placeholder scan:** no TBD/TODO; all code blocks complete; the only deliberately-deferred value is `UPDATER_IMAGE`, which Task 1 Step 6 resolves empirically with a defined fallback.
