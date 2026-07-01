# Fix api-test tsconfig rootDir/emit errors — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `api-test`'s two TypeScript errors (rootDir violation + `baseUrl` deprecation) structurally impossible by declaring its tsconfig as type-check-only.

**Architecture:** `api-test` never runs `tsc` and never emits — it is type-checked by the IDE and executed by Vitest (esbuild). Its `tsconfig.json` is a verbatim copy of the emit-oriented `backend/tsconfig.json`. Turning on `noEmit` and removing the dead emit keys removes the `rootDir` constraint that the `paths → ../packages/types/src` mapping violates. Then delete the now-pointless `tsconfig.build.json`.

**Tech Stack:** TypeScript 5.9, Vitest, pnpm workspaces, TurboRepo, Docker Compose (`just`).

**Spec:** `docs/superpowers/specs/2026-07-01-fix-api-test-tsconfig-rootdir-design.md`

## Global Constraints

- Scope is `api-test/` only. Do NOT touch `backend/tsconfig.json` (same latent shape, not currently erroring — out of scope).
- Do NOT change the `paths` mapping or any test file. The `paths → source` mapping is intentional.
- No new dependencies.
- Commit messages: this repo's Husky `prepare-commit-msg` hook auto-prepends `chore: 000 - ` (from branch `chore/000/weekly-updates`). Provide the **bare description only** — no type prefix, no ticket id.
- `pnpm` prints `Unsupported engine: wanted node >=22.23.1 (current v22.14.0)` — this is a harmless warning, not a failure. Ignore it.
- All service booting for verification MUST be done by a dispatched subagent, not the primary session.

---

### Task 1: Convert `api-test/tsconfig.json` to type-check-only

**Files:**
- Modify: `api-test/tsconfig.json`

**Interfaces:**
- Consumes: nothing.
- Produces: an `api-test/tsconfig.json` with `noEmit: true` and no emit/`baseUrl` keys. Task 3's verification relies on `cd api-test && pnpm exec tsc` exiting clean.

- [ ] **Step 1: Reproduce the failure (RED)**

Run:
```bash
cd api-test && pnpm exec tsc
```
Expected: NON-zero exit with both errors, e.g.
```
error TS6059: File '.../packages/types/src/index.ts' is not under 'rootDir' '.../api-test'.
error TS6307/TS6059: The common source directory ... is '..'. The 'rootDir' setting must be explicitly set ...
error: Option 'baseUrl' is deprecated ... TypeScript 7.0 ...
```
(The exact TS error codes may vary by patch version; the point is the run FAILS on rootDir + baseUrl.)

- [ ] **Step 2: Clean any partial emit from the RED run**

The old config has `declaration`/`incremental`, so the failed run may have written `dist/` or a `.tsbuildinfo`. Remove them so they are never committed:
```bash
rm -rf api-test/dist api-test/*.tsbuildinfo
cd /Users/leejianhong/projects/personal-project/maintenance-tracker && git -C api-test status --short
```
Expected: no `dist/` or `.tsbuildinfo` shown as untracked.

- [ ] **Step 3: Rewrite the config (GREEN change)**

Replace the entire contents of `api-test/tsconfig.json` with:
```jsonc
{
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "resolvePackageJsonExports": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2023",
    "noEmit": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "forceConsistentCasingInFileNames": true,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "noFallthroughCasesInSwitch": false,
    "types": ["vitest/globals"],
    "paths": {
      "@project/types": ["../packages/types/src"],
      "src": ["./src"]
    }
  }
}
```
Removed vs. before: `declaration`, `removeComments`, `emitDecoratorMetadata`, `experimentalDecorators`, `sourceMap`, `outDir`, `baseUrl`, `incremental`. Added: `noEmit`.

- [ ] **Step 4: Verify the errors are gone (GREEN)**

Run:
```bash
cd api-test && pnpm exec tsc
```
Expected: exit code 0, NO output (clean type-check, no emit). Confirm no `dist/` was created:
```bash
ls api-test/dist 2>/dev/null && echo "UNEXPECTED dist" || echo "no dist — good"
```
Expected: `no dist — good`.

- [ ] **Step 5: Format and lint**

Run from repo root:
```bash
just format
just lint
```
Expected: both succeed (turbo may report cache hits for unchanged packages; `api-test` re-runs clean).

- [ ] **Step 6: Commit**

```bash
git add api-test/tsconfig.json
git commit -m "make api-test tsconfig type-check-only to fix rootDir/baseUrl errors"
```
Expected: commit created; Husky rewrites the message to `chore: 000 - make api-test tsconfig type-check-only to fix rootDir/baseUrl errors`.

---

### Task 2: Remove the unreferenced `tsconfig.build.json`

**Files:**
- Delete: `api-test/tsconfig.build.json`

**Interfaces:**
- Consumes: the type-check-only `tsconfig.json` from Task 1.
- Produces: nothing downstream depends on this deletion.

- [ ] **Step 1: Prove it is unreferenced**

Run from repo root:
```bash
grep -rn "tsconfig.build" . 2>/dev/null | grep -vE "node_modules|\.turbo|docs/superpowers"
```
Expected: NO output (the only matches are this plan/spec under `docs/superpowers` and `.turbo` logs, both excluded). If ANY real reference appears (a `just` target, a CI job, a package script, a turbo pipeline entry), STOP — do not delete; leave the file and note the reference in the task checkbox instead.

- [ ] **Step 2: Delete the file**

```bash
git rm api-test/tsconfig.build.json
```

- [ ] **Step 3: Confirm nothing broke**

```bash
cd api-test && pnpm exec tsc
```
Expected: exit 0, clean (unchanged from Task 1 — `tsconfig.build.json` was never used).

- [ ] **Step 4: Commit**

```bash
git commit -m "remove unused api-test tsconfig.build.json"
```
Expected: commit created (Husky prepends `chore: 000 - `).

---

### Task 3: Verify against live services (agent-booted stack)

This task MUST be executed by a dispatched subagent (e.g. `general-purpose`). The subagent boots the full Docker stack, runs the real api-test suite against the live backend, confirms green, and tears the stack down. This is verification only — no code changes, no commit.

**Files:** none (verification only).

**Interfaces:**
- Consumes: the fixed `api-test/tsconfig.json` from Task 1.
- Produces: pass/fail evidence for the acceptance criteria.

Dispatch a subagent with the following instructions verbatim:

- [ ] **Step 1: Boot the full stack detached**

> Note: the `just up-build` target uses `docker compose up --build -w` (watch mode), which stays attached in the foreground. For automated verification, bring the stack up **detached** instead so subsequent commands can run:
```bash
cd /Users/leejianhong/projects/personal-project/maintenance-tracker
docker compose -p maintenance-tracker up -d --build
```
Expected: images build and containers start (`postgres`, `redis`, `firebase-emulator`, `server`, `db-migration-service`, `client`, `worker`). Allow several minutes for the first build. Timeout: 600000 ms.

- [ ] **Step 2: Wait for the backend to be healthy**

Poll the backend health endpoint until it returns 200 (the api-test suite targets `http://localhost:3001`):
```bash
for i in $(seq 1 60); do
  if curl -sf http://localhost:3001/ >/dev/null; then echo "backend healthy"; break; fi
  echo "waiting for backend ($i)..."; sleep 5
done
curl -s http://localhost:3001/
```
Expected: `backend healthy`, and the final `curl` prints a JSON body with `"isHealthy":true`.

- [ ] **Step 3: Run the api-test suite against the live backend**

```bash
cd /Users/leejianhong/projects/personal-project/maintenance-tracker
just test-api
```
Expected: Vitest runs `health-check.spec.ts`, `vehicles.spec.ts`, and `maintenance-cards.spec.ts`; ALL specs pass (the suite is self-seeding — `createTestUser` in `beforeAll`, each spec creates its own vehicles). Exit code 0.

- [ ] **Step 4: Tear the stack down**

```bash
docker compose -p maintenance-tracker down
```
Expected: all containers stopped and removed.

- [ ] **Step 5: Report**

Report to the primary session: whether `just test-api` passed, the Vitest pass/fail summary line, and any failures with output.

---

## Acceptance criteria (from spec)

- [ ] `cd api-test && pnpm exec tsc` produces zero errors (both original errors gone) — Task 1 Step 4.
- [ ] `@project/types` still resolves in api-test spec files (no unresolved import / type errors) — covered by the clean `tsc` run.
- [ ] Full stack boots via an agent-driven detached compose up, and the api-test suite passes green against the live backend — Task 3.
- [ ] `tsconfig.build.json` removed after proving it is unreferenced — Task 2.
- [ ] `just format` and `just lint` clean — Task 1 Step 5.

## Self-review notes

- **Spec coverage:** every acceptance criterion maps to a task step (listed above). ✔
- **Placeholder scan:** no TBD/TODO; every code/config step shows exact content and commands. ✔
- **Type consistency:** the final `tsconfig.json` in Task 1 Step 3 is the single source of truth; Task 2 and Task 3 reference it without redefining. ✔
- **RED reproducibility:** Task 1 Step 1 runs `tsc` WITHOUT `--noEmit` on purpose — `--noEmit` would suppress the very rootDir/emit errors we need to observe. ✔
