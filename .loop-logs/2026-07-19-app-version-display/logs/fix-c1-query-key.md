# Fix C1 — inconsistent singleton-resource query key in useVersion

## What changed

File: `frontend/src/hooks/queries/version/useVersion.ts`

Replaced the `getQueryKey({ group: QueryGroup.VERSION, type: QueryType.ONE, key: '' })`
call with a flat singleton key `[QueryGroup.VERSION]`, mirroring the existing
`useAppConfig.ts` pattern. Removed now-unused `getQueryKey` and `QueryType`
imports (kept `QueryGroup`). Added the same explanatory comment as `useAppConfig`.

Diff: 4 insertions, 6 deletions.

## Why

`version` is a true singleton resource (like app config), not "one entity by id".
`QueryType.ONE` semantics imply an id, so passing `key: ''` was a category error.
`useAppConfig.ts` already established the correct flat-key pattern for singletons;
this brings `useVersion` in line with it.

## Test / lint output

- `pnpm exec vitest run src/hooks/queries/version/useVersion.spec.ts` → PASS (2) FAIL (0), unchanged.
  Spec only asserts `apiClient.get('/version')` was called and the returned data;
  it does not assert the query key directly, so no spec change was needed.
- `just lint` (worktree root) → Tasks: 5 successful, 5 total. EXIT 0.
  No unused-import errors (removed `getQueryKey`/`QueryType`).

## Commit

`a67a55f4f2064fdf2a7e72508dd325747bee2e6e` — "fix: 000 - use flat singleton query key for useVersion, matching useAppConfig"

Branch: `fix/000/useversion-singleton-query-key`
Worktree: `.worktrees/fix-c1-query-key`
