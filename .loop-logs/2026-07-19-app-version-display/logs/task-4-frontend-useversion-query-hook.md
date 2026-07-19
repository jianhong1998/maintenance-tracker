# Task 4 Log: Frontend `useVersion` query hook

## Task Context

### Plan Section
### Task 4: Frontend `useVersion` query hook

**Files:**
- Modify: `frontend/src/hooks/queries/keys/key.ts`
- Create: `frontend/src/hooks/queries/version/useVersion.ts`
- Create: `frontend/src/hooks/queries/version/useVersion.spec.ts`

**Interfaces:**
- Consumes: `IVersionResDTO` from `@project/types` (Task 1); `apiClient.get<T>(endpoint)`; `getQueryKey`, `QueryGroup`, `QueryType` from `../keys`.
- Produces: `useVersion()` returning a TanStack Query result of `IVersionResDTO`; new `QueryGroup.VERSION = 'version'`.

- [ ] **Step 1: Add the VERSION query group**

In `frontend/src/hooks/queries/keys/key.ts`, add `VERSION: 'version',` to the `QueryGroup` object:
```ts
export const QueryGroup = Object.freeze({
  HEALTH_CHECK: 'health-check',
  CONFIG: 'config',
  VEHICLES: 'vehicles',
  MAINTENANCE_CARDS: 'maintenance-cards',
  FEATURE_FLAG: 'feature-flag',
  VERSION: 'version',
} as const);
```

- [ ] **Step 2: Write the failing hook test**

Create `frontend/src/hooks/queries/version/useVersion.spec.ts` (mocks `@/lib/api-client`, uses `createWrapper` from `../test-utils`).

- [ ] **Step 3: Run the hook test to verify it fails** — cannot resolve `./useVersion`.

- [ ] **Step 4: Implement the hook** at `frontend/src/hooks/queries/version/useVersion.ts`.

- [ ] **Step 5: Run the hook test to verify it passes.**

- [ ] **Step 6: Format, lint, commit.**

### Acceptance Criteria
- AC-1: hook calls `apiClient.get('/version')` exactly once
- AC-2: hook returns the version data (`{ version: '1.1.2' }`)
- AC-3: `QueryGroup.VERSION` exists

---

## Attempt 1 — 2026-07-19T00:00:00Z

### Implementation Plan
- Install worktree deps and build `@project/types` (worktree lacks node_modules/dist)
- Add `VERSION: 'version'` to `QueryGroup` in `keys/key.ts`
- Write failing hook test mocking `@/lib/api-client`, using `createWrapper` from `../test-utils`
- Confirm FAIL (unresolved `./useVersion`), implement hook, confirm PASS
- Run `just format` + `just lint`

### Files Changed
- modified `frontend/src/hooks/queries/keys/key.ts` — added `QueryGroup.VERSION`
- created `frontend/src/hooks/queries/version/useVersion.ts` — TanStack Query hook, `staleTime: Infinity`
- created `frontend/src/hooks/queries/version/useVersion.spec.ts` — hook unit tests

### New Tests
- `calls apiClient.get("/version")`
- `returns the version data`

### Key Decisions
- `../test-utils` import verified correct: spec at `version/useVersion.spec.ts` resolves to `queries/test-utils.ts`; `createWrapper` exported there. No path change needed.

### Lint Output
PASS

### Test Output
PASS (2 passed, 2 new)

### Commit
`e64b854`

### Outcome: success
