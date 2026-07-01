# Fix api-test tsconfig rootDir / emit errors — Design

**Date:** 2026-07-01
**Status:** Approved (design)
**Scope:** `api-test/` only. Backend is explicitly out of scope.

---

## Problem

`api-test` surfaces two TypeScript errors:

1. On `src/tests/*.spec.ts`:
   > File `packages/types/src/index.ts` is not under `rootDir` `api-test`.
   > 'rootDir' is expected to contain all source files.
   > The file is in the program because: Imported via `@project/types`.

2. On `tsconfig.json`:
   > The common source directory of `tsconfig.json` is `..`. The `rootDir`
   > setting must be explicitly set to this or another path.
   > Option `baseUrl` is deprecated and will stop functioning in TypeScript 7.0.

## Root cause (from five-why review)

The two errors are **one bug wearing two hats**:

1. `paths["@project/types"] = ["../packages/types/src"]` pulls the sibling
   package's **source** into api-test's TS program as an input file.
2. `declaration: true` (emit is on) forces TS to compute an **output path for
   every input file**, which requires all inputs under one `rootDir`.
3. Inputs now straddle two directories (`api-test/src` **and**
   `packages/types/src`), so the inferred common root climbs to `..` → error #2;
   and if `rootDir` is `api-test`, the types source falls outside → error #1.
4. Emit is on only because `api-test/tsconfig.json` is a **byte-for-byte copy**
   of `backend/tsconfig.json` (a package that genuinely builds). api-test never
   runs `tsc`, never emits, never produces `dist` — it is type-checked by the
   IDE and executed by Vitest (esbuild). The emit config is a lie about what the
   package does.

**Root cause:** api-test carries an emit-oriented tsconfig, but it is a
type-check-only workspace. The emit requirement (`declaration`/`outDir`) is the
*only* reason cross-package source inclusion is illegal. Remove the emit
requirement and both errors become structurally impossible.

## Non-goals

- No change to `backend/tsconfig.json` (same latent shape, but not currently
  erroring — its inputs stay under `backend/` until build time).
- No change to test files, axios config, or the `paths` mapping itself. The
  `paths → source` mapping is intentional and correct for a workspace that
  consumes shared types without a pre-build step.
- No new dependencies.

---

## Solution

Rewrite `api-test/tsconfig.json` to declare its real job: **type-check only.**

Add `"noEmit": true` and remove every option that only matters for a package
that emits:

| Removed key            | Why it's dead in api-test                          |
| ---------------------- | -------------------------------------------------- |
| `declaration`          | Nothing emits `.d.ts`. This key is what triggers the rootDir constraint. |
| `outDir`               | No build output.                                   |
| `sourceMap`            | No emitted JS to map.                               |
| `incremental`          | No emit → no `.tsbuildinfo` value.                  |
| `removeComments`       | Emit-only.                                          |
| `emitDecoratorMetadata`| api-test has no decorators.                         |
| `experimentalDecorators`| api-test has no decorators.                        |
| `baseUrl`              | Deprecated (TS 7.0); `paths` resolves without it.  |

### Resulting `api-test/tsconfig.json`

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

### `tsconfig.build.json` follow-up

`api-test/tsconfig.build.json` only `extends` the main config and sets
`exclude`. api-test has **no build script** and nothing appears to invoke it.
It is *likely deletable*, but the plan must **verify it is truly unreferenced**
(turbo pipeline, CI config, package scripts, root `just`/pnpm commands) before
removing it. Do not delete blind. If any reference exists, leave it and note why.

---

## Verification

Verification requires a **real API run against local services**, and **all
services are booted by an agent** (not the primary session).

1. **Direct proof the errors are gone (TDD red → green).**
   `cd api-test && pnpm exec tsc` currently emits both errors. After the fix it
   must exit clean with no diagnostics. This is the failing check the fix turns
   green.

2. **Real-services proof nothing broke.** A dispatched subagent:
   - boots the full stack via `just up-build` (postgres, server, client,
     db-migration-service),
   - waits for the backend to be healthy,
   - runs the api-test suite against the live backend (`just test-api`, or
     `pnpm test` inside `api-test`),
   - confirms every spec passes,
   - tears the stack down.

3. **Repo hygiene.** `just format` and `just lint` run clean.

### Acceptance criteria

- [ ] `cd api-test && pnpm exec tsc` produces **zero** errors (both original
      errors gone).
- [ ] `@project/types` still resolves in api-test spec files (no unresolved
      import / type errors).
- [ ] Full stack boots via `just up-build` (agent-driven) and the api-test
      suite passes green against the live backend.
- [ ] `tsconfig.build.json` either removed (if proven unreferenced) or kept
      with a documented reason.
- [ ] `just format` and `just lint` clean.

---

## Risks

- **Low.** Single config file, no runtime code touched. Vitest already runs via
  esbuild and ignores these `tsc` emit options, so test execution behavior is
  unchanged. The only observable difference is that `tsc` type-checking now
  completes cleanly.
