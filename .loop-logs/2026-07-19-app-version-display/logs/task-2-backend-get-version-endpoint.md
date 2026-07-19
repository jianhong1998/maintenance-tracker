# Task 2 Log: Backend GET /version endpoint

## Task Context

### Plan Section
### Task 2: Backend `GET /version` endpoint

**Files:**
- Create: `backend/src/modules/app/dtos/version.dto.ts`
- Create: `backend/src/modules/app/controllers/app.controller.spec.ts`
- Modify: `backend/src/modules/app/services/app.service.ts`
- Modify: `backend/src/modules/app/services/app.service.spec.ts`
- Modify: `backend/src/modules/app/controllers/app.controller.ts`

**Interfaces:**
- Consumes: `IVersionResDTO` from `@project/types` (Task 1).
- Produces: `AppService.getVersion(): { version: string }`; `AppController.getVersion()` returning `VersionResDTO`; HTTP `GET /version` → `{ version: string }`.

- [ ] **Step 1: Write the failing service test**

Append to `backend/src/modules/app/services/app.service.spec.ts`:
```ts
describe('#getVersion', () => {
  const original = process.env.BACKEND_APP_VERSION;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.BACKEND_APP_VERSION;
    } else {
      process.env.BACKEND_APP_VERSION = original;
    }
  });

  it('returns the version from BACKEND_APP_VERSION when set', () => {
    process.env.BACKEND_APP_VERSION = '1.2.3';
    expect(new AppService().getVersion()).toEqual({ version: '1.2.3' });
  });

  it("falls back to 'unreleased' when BACKEND_APP_VERSION is unset", () => {
    delete process.env.BACKEND_APP_VERSION;
    expect(new AppService().getVersion()).toEqual({ version: 'unreleased' });
  });
});
```

- [ ] **Step 2: Run the service test to verify it fails**

- [ ] **Step 3: Implement `getVersion` in the service**

- [ ] **Step 4: Run the service test to verify it passes**

- [ ] **Step 5: Create the response DTO**

- [ ] **Step 6: Write the failing controller test**

- [ ] **Step 7: Run the controller test to verify it fails**

- [ ] **Step 8: Add the endpoint to the controller** (uses `@Public()`)

- [ ] **Step 9: Run both app specs to verify they pass**

- [ ] **Step 10: Manually verify the running endpoint** (`curl -s http://localhost:3001/version`)

- [ ] **Step 11: Format, lint, commit**

### Acceptance Criteria
- AC-1: `AppService.getVersion()` returns `{ version: process.env.BACKEND_APP_VERSION }` when the env var is set
- AC-2: `AppService.getVersion()` falls back to `{ version: 'unreleased' }` when `BACKEND_APP_VERSION` is unset
- AC-3: `AppController.getVersion()` wraps the service value in a `VersionResDTO`
- AC-4: `GET /version` is public (unauthenticated) via `@Public()`

---

## Attempt 1 — 2026-07-19T07:21:46Z

### Implementation Plan
- Append failing `#getVersion` service test (env set + unset fallback), confirm FAIL
- Implement `AppService.getVersion()` reading `process.env.BACKEND_APP_VERSION ?? 'unreleased'`
- Create `VersionResDTO` implementing `IVersionResDTO`; add failing controller test, confirm FAIL
- Add `@Public() @Get('version')` endpoint wrapping service value in `VersionResDTO`
- Run all `src/modules/app` specs, format, lint

### Files Changed
- modified `backend/src/modules/app/services/app.service.ts` — added `getVersion()` with env fallback
- modified `backend/src/modules/app/services/app.service.spec.ts` — added `#getVersion` describe block
- created `backend/src/modules/app/dtos/version.dto.ts` — `VersionResDTO implements IVersionResDTO`
- created `backend/src/modules/app/controllers/app.controller.spec.ts` — controller unit test
- modified `backend/src/modules/app/controllers/app.controller.ts` — public `GET /version` endpoint

### New Tests
- `#getVersion returns the version from BACKEND_APP_VERSION when set`
- `#getVersion falls back to 'unreleased' when BACKEND_APP_VERSION is unset`
- `AppController #getVersion wraps the service version in a VersionResDTO`

### Key Decisions
- Followed health-check DTO's plain `import { IVersionResDTO }` (not `import type`) — `VersionResDTO` is undecorated, so the `isolatedModules` + `emitDecoratorMetadata` constraint does not apply; lint/tsc pass.
- Built `@project/types` inside the worktree (dist is gitignored) after `pnpm install`, so the shared type resolves.
- Step 10 curl skipped: local services not running (non-blocking per plan).

### Lint Output
PASS

### Test Output
PASS (4 files, 3 new)

### Commit
`d827ee1`

### Outcome: success
