# Task 1 Log: Convert api-test/tsconfig.json to type-check-only

## Task Context

### Plan Section

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

### Acceptance Criteria
- AC-1: `cd api-test && pnpm exec tsc` produces zero errors (both original errors gone)
- AC-2: `@project/types` still resolves in api-test spec files (no unresolved import / type errors)
- AC-3: `just format` and `just lint` clean

---

## Attempt 1 — 2026-07-01T04:48:08Z

### Implementation Plan
- Reproduce RED: run `pnpm exec tsc` in api-test under the old emit-oriented config.
- Clean any emit artifacts (`dist/`, `*.tsbuildinfo`) from the RED run.
- Rewrite `api-test/tsconfig.json` to the type-check-only JSON from the plan (`noEmit: true`, drop `declaration`/`outDir`/`sourceMap`/`incremental`/`removeComments`/`emitDecoratorMetadata`/`experimentalDecorators`/`baseUrl`).
- Verify GREEN: `pnpm exec tsc` exits 0 and emits no `dist/`.
- `just format` && `just lint` from worktree root; commit with bare message.

### Files Changed
- modified `api-test/tsconfig.json` — declares the workspace as type-check-only (`noEmit: true`), removing all emit-only keys and deprecated `baseUrl`.

### New Tests
(none — config-only change)

### Key Decisions
- **RED did not manifest as the plan's two hard `tsc` errors under TypeScript 5.9.3.** A fresh `pnpm exec tsc` on the OLD config exited 0 with no diagnostics — no `TS6059` rootDir error and no `baseUrl` deprecation warning. Instead the defect manifested as the config **silently emitting a cross-package `dist/` tree**: `dist/api-test/src` AND `dist/packages/types` (verified via `tsc --listEmittedFiles` / `find dist`). This is exactly the "emit is a lie" defect the spec describes (api-test never emits, yet the emit config pulls sibling `packages/types/src` in and rebases the common source dir to `..`), just non-fatal in this TS patch version. The observable RED→GREEN used for TDD: **RED = emits cross-package dist; GREEN = `noEmit`, zero dist, clean type-check.** The approved fix is unchanged and still fully satisfies the real acceptance criteria.
- **Branch rename to satisfy the Husky hook.** The instructed worktree branch `worktree/task-1-...` is rejected by `.husky/prepare-commit-msg`, whose branch-name pattern only accepts `^(chore|feat|fix|bugfix|docs|style|refactor|test|build|ci|perf|revert|config|plan)/[0-9]+/.+$`. Renamed the worktree branch to `chore/000/task-1-convert-api-test-tsconfig-json-to-type-check-only` so the hook prepends the intended `chore: 000 - ` prefix. Did NOT use `--no-verify`.

### Lint Output
PASS (`just format`: 4 tasks successful; `just lint`: 5 tasks successful, api-test:lint executed fresh cache-miss and passed clean)

### Test Output
PASS (tsc exits 0, no diagnostics) — GREEN `pnpm exec tsc` exit 0, `no dist — good`.

### Commit
4dd13ef

### Outcome: success
