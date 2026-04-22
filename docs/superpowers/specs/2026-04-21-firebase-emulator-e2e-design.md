# Firebase Auth Emulator for E2E Testing — Design

**Date:** 2026-04-21
**Status:** Approved (ready for implementation plan)

---

## Context

We want to add Playwright E2E tests for the maintenance-tracker app. The blocker is Firebase Authentication: the frontend uses `signInWithPopup(GoogleAuthProvider)` and the backend verifies tokens with `firebase-admin`. Real Google OAuth in CI is impractical (popup, real accounts, brittle).

Today, the backend has a side-door for `api-test/`: a `BACKEND_ENABLE_API_TEST_MODE` flag that accepts `Bearer api-test-token` and resolves to a hardcoded user. This bypass works for API tests but cannot drive the real frontend login flow — and it adds a special case to the auth guard.

This design replaces the bypass with a single, real auth path powered by the Firebase Auth Emulator. The emulator is wired into local dev, CI pipeline, and a new E2E compose profile. Both `api-test/` and the new `e2e/` workspace mint emulator-issued ID tokens via the emulator's REST endpoints. The backend always runs `verifyIdToken` — pointed at real Firebase in prod, at the emulator in dev/CI.

## Goals

- Enable Playwright E2E tests that exercise the **real** login flow (button → Firebase SDK → token → backend).
- Eliminate the `api-test-token` bypass from the auth guard. One auth path, no special cases.
- Reproducible via `just` commands on dev machine and CI.
- Tests run in parallel (each test gets a unique user → no shared-state contention).

## Non-Goals

- Replacing real Firebase in production. Prod still uses real Firebase Auth.
- Testing Google OAuth itself (the emulator stubs the provider screen — we test our flow, not Google's).
- Visual regression / screenshot diffing (separate concern).

## Architecture

### Components

```
┌─────────────────┐    ┌──────────────────────────┐    ┌──────────────┐
│ Playwright tests│───▶│ frontend (Next.js client)│───▶│ backend (API)│
│ (e2e/ workspace)│    │  connectAuthEmulator()   │    │ verifyIdToken│
└────────┬────────┘    └────────────┬─────────────┘    └──────┬───────┘
         │                          │                          │
         │ REST: createUser/wipe    │ REST: signIn/refresh     │ REST: verify
         ▼                          ▼                          ▼
                  ┌──────────────────────────────────┐
                  │  firebase-emulator (port 9099)   │
                  │   project: maintenance-tracker-e2e│
                  └──────────────────────────────────┘
```

All three callers (Playwright, frontend, backend) reach the same emulator. Test users are created via the emulator's REST endpoint; tokens flow through the normal Firebase SDK paths.

### Service: `firebase-emulator`

A new container in `docker-compose.yml` (and `docker-compose.pipeline.yml`, `docker-compose.e2e.yml`).

- **Image:** Custom Dockerfile (`docker/local/Dockerfile.firebase-emulator`) installing a pinned `firebase-tools` version on `node:20-alpine`. Pinning protects against upstream breakage.
- **Config:** Minimal `docker/firebase/firebase.json` enabling only the auth emulator on port 9099. No UI emulator (port 4000) — not needed.
- **Project ID:** `maintenance-tracker-e2e` (fixed). Used by all three callers.
- **Network mode:** `host` to match existing services.
- **Healthcheck:** HTTP probe on `http://localhost:9099/` (returns 200 when ready).

### Backend changes

1. `FirebaseService.onModuleInit`:
   - **Read `BACKEND_ENABLE_MOCK_AUTH` (the gate) first.**
     - If `true`: read our own `FIREBASE_AUTH_EMULATOR_HOST` value. If missing, throw — fail fast at startup. Otherwise propagate to `process.env.FIREBASE_AUTH_EMULATOR_HOST` so the Admin SDK auto-recognizes it and routes `verifyIdToken` to the emulator.
     - If `false`: actively `delete process.env.FIREBASE_AUTH_EMULATOR_HOST` **before** calling `initializeApp`. This neutralises any accidental inheritance — the SDK can never silently switch to emulator mode in production even if some other tool sets that env var.
   - The three `FIREBASE_*` credential vars (`PROJECT_ID`, `CLIENT_EMAIL`, `PRIVATE_KEY`) are still required for `initializeApp`. In dev/CI, `.env` provides placeholder values for `CLIENT_EMAIL` and `PRIVATE_KEY` (the SDK doesn't use them when verifying emulator-issued tokens).

2. `FirebaseAuthGuard.canActivate`:
   - Delete the `enableApiTestMode` branch.
   - Delete `API_TEST_TOKEN`, `API_TEST_UID`, `API_TEST_EMAIL` constants.
   - Single path: extract bearer → `verifyIdToken` → `resolveUser`.

3. `EnvironmentVariableUtil.getFeatureFlags`:
   - Remove `enableApiTestMode` from the returned shape.
   - Remove `BACKEND_ENABLE_API_TEST_MODE` reading.
   - Update `getFeatureFlags` consumers (config controller, guard) and tests.

### Frontend changes

1. Extend `getFirebaseConfig()` server action:
   - Read `FRONTEND_ENABLE_MOCK_AUTH` (the gate).
   - If `true`: also read `FRONTEND_FIREBASE_AUTH_EMULATOR_HOST` and return it as `authEmulatorHost`. If the host is missing, throw — fail fast.
   - If `false`: return `authEmulatorHost: undefined` regardless of any other var. The frontend has no path to the emulator.

2. `frontend/src/lib/firebase.ts` `initFirebase()`:
   - After `getAuth(app)`, if `config.authEmulatorHost` is non-empty, call `connectAuthEmulator(auth, http://${authEmulatorHost}, { disableWarnings: true })`.
   - **Also when `authEmulatorHost` is set**, expose a test-only global `window.__e2eAuth = { signIn(email, password) }` that wraps `signInWithEmailAndPassword(auth, email, password)`. This is the handle Playwright uses to drive authentication from the browser context (see `loginAs` below).
   - Production deployments leave `FRONTEND_ENABLE_MOCK_AUTH` unset/false → real Firebase, no emulator code path reachable, `window.__e2eAuth` never defined.

3. No other frontend code changes. The auth provider, login button, and token retrieval all work unchanged because `connectAuthEmulator` is transparent to consumers.

#### Why `window.__e2eAuth` instead of dynamic `import('firebase/auth')` from `page.evaluate`?

The first design drafted used `await import('firebase/auth')` inside `page.evaluate`. That does not work in a Next.js build: bare module specifiers like `firebase/auth` are resolved by the bundler at build time and are not exposed to arbitrary browser code via a runtime import map. The webpack/turbopack module registry is opaque from outside the bundle.

The alternatives considered:

- **Rebuild the login path via REST + IndexedDB injection.** Mint an ID token via the emulator REST API, then hand-craft the Firebase Auth persistence key in IndexedDB. Fragile (persistence format is internal to the SDK) and requires maintaining a second source of truth.
- **Expose the `Auth` instance directly on `window`.** Same blast radius as `__e2eAuth` but a wider surface (any SDK method, not just sign-in). Worse.
- **Expose a narrow `signIn(email, password)` helper on `window` only when the emulator gate is on** ← chosen. One method, one purpose, gated.

### `api-test/` migration

1. Add an `auth-helper.ts` (`api-test/src/helpers/`) that:
   - Generates a random email (`api-test-${uuid}@test.local`).
   - Calls `POST http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake` with the email + a fixed password → emulator returns `idToken`.
   - Returns `{ idToken, email }`.
2. Update each test file to call the helper in `beforeAll` (or per-test) and use the returned `idToken` in the `Authorization` header.
3. Delete the hardcoded `API_TEST_TOKEN = 'Bearer api-test-token'` lines.
4. Add an emulator-wipe call in a global `beforeAll` (optional — unique users mean no collision, but tidy).

### New `e2e/` workspace

```
e2e/
├── package.json              # @e2e workspace
├── playwright.config.ts      # baseURL=http://localhost:3000, projects: chromium
├── tsconfig.json
├── eslint.config.mjs
└── src/
    ├── fixtures/
    │   ├── auth.fixture.ts   # exposes `loginAs(page, { email? })`
    │   └── emulator.ts       # REST helpers: signUp, wipeAccounts
    ├── global-setup.ts       # wipes emulator + db at suite start
    └── tests/
        ├── auth-popup.spec.ts        # the ONE real-popup login test
        ├── vehicles.spec.ts          # uses loginAs() fast path
        └── maintenance-cards.spec.ts # uses loginAs() fast path
```

#### `loginAs` fast-path fixture

```ts
export async function loginAs(page: Page, opts?: { email?: string }) {
  const email = opts?.email ?? `e2e-${randomUUID()}@test.local`;
  const password = 'test-password';
  await emulatorSignUp({ email, password }); // REST → emulator
  await page.goto('/login');
  // window.__e2eAuth is exposed by initFirebase() only when the emulator gate
  // is on. Production builds never define this property.
  await page.waitForFunction(() => typeof (window as any).__e2eAuth !== 'undefined');
  await page.evaluate(
    async ({ email, password }) => {
      await (window as any).__e2eAuth.signIn(email, password);
    },
    { email, password },
  );
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
  return { email };
}
```

The emulator accepts `signInWithEmailAndPassword` for any user created via signUp, even though prod only uses Google sign-in. Production code is untouched — the helper just calls a different SDK method against the emulator from inside the page context via the gated `window.__e2eAuth` handle.

#### Real-popup test (`auth-popup.spec.ts`)

Drives the actual `signInWithPopup(GoogleAuthProvider)` flow:
1. Navigate to `/login`.
2. Click "Sign in with Google".
3. Wait for the popup window event.
4. In the popup: emulator's stub picker page → click "Add new account" → fill email → submit.
5. Assert post-login state in the main page.

This single test covers the wire from button → Firebase SDK → emulator → backend `verifyIdToken` → user resolution.

### Docker Compose layout

- **`docker-compose.yml`** (base): adds `firebase-emulator` service. Local dev gets it for free.
- **`docker-compose.pipeline.yml`** (CI): adds the same `firebase-emulator` service. Backend and api-test now depend on it.
- **`docker-compose.e2e.yml`** (new overlay): used as `docker compose -f docker-compose.yml -f docker-compose.e2e.yml up`. Adds:
  - `playwright-runner`: builds from a new `docker/local/Dockerfile.playwright`, mounts `e2e/`, runs `pnpm --filter e2e test`. Depends on `client`, `server`, `firebase-emulator` (all healthy).
  - Optionally exposes Playwright HTML report path via volume.

### Justfile commands

```
just up-build            # unchanged — now also starts firebase-emulator
just emulator-wipe       # POST to emulator wipe endpoint (debug aid)
just test-e2e            # docker compose -f ... -f docker-compose.e2e.yml up --abort-on-container-exit playwright-runner
just test-api            # unchanged — but now requires firebase-emulator to be up
```

### Environment variables

New entries in `.env.template`:

```
# Firebase Auth Emulator gates (must be false in production/staging)
BACKEND_ENABLE_MOCK_AUTH=true
FRONTEND_ENABLE_MOCK_AUTH=true

# Emulator address — only consulted when the corresponding gate is true
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
FRONTEND_FIREBASE_AUTH_EMULATOR_HOST=localhost:9099

# Placeholder credentials — real values not used when emulator gate is true
FIREBASE_PROJECT_ID=maintenance-tracker-e2e
FIREBASE_CLIENT_EMAIL=placeholder@example.com
FIREBASE_PRIVATE_KEY=placeholder

# Removed
# BACKEND_ENABLE_API_TEST_MODE=true
```

**Production / staging:** set `BACKEND_ENABLE_MOCK_AUTH=false` and `FRONTEND_ENABLE_MOCK_AUTH=false` (or omit). Supply real Firebase credentials. The host vars are ignored when the gates are off, but for hygiene also leave them unset.

**Two-key safety property:** the emulator code path is only reachable when **both** the gate is true **and** the host is set. The backend additionally `delete`s `process.env.FIREBASE_AUTH_EMULATOR_HOST` at startup when the gate is off, so the Admin SDK cannot silently route to an emulator even if some other process sets that variable.

**`window.__e2eAuth` four-key safety:** the sign-in helper exposed on `window` is only a real attack surface if **all four** of these env states hold simultaneously in production:

1. `FRONTEND_ENABLE_MOCK_AUTH=true`
2. `FRONTEND_FIREBASE_AUTH_EMULATOR_HOST` set and reachable
3. `BACKEND_ENABLE_MOCK_AUTH=true`
4. `FIREBASE_AUTH_EMULATOR_HOST` set and reachable on the backend host

Miss any one of these and an attacker who finds `__e2eAuth` in the console either (a) signs into an unreachable emulator and gets no token, or (b) gets an emulator-issued token that the real backend's `verifyIdToken` rejects as unsigned. All four are `false`/unset by default in production env files and each is individually a glaring red flag on deployment review.

## Test Isolation

- **Emulator users:** each test mints a unique uid+email via `emulatorSignUp`. No reset between tests.
- **DB:** backend `resolveUser` creates the matching `UserEntity` lazily on first authed request. Different uids → different rows → no contention.
- **Suite start:** `global-setup.ts` wipes emulator (`DELETE /emulator/v1/projects/maintenance-tracker-e2e/accounts`) and resets DB (`pnpm --filter backend run db-data-reset` or equivalent). Clean slate per CI run.
- **Parallelism:** Playwright workers run in parallel. Unique-user-per-test guarantees safety.

## Migration Sequence

The implementation must keep the system runnable at every step.

1. Add `firebase-emulator` service to base + pipeline compose. Verify it boots.
2. Wire backend `FIREBASE_AUTH_EMULATOR_HOST` env var in `.env.template`. Backend continues to work because the bypass still exists.
3. Update `api-test/` to use emulator-issued tokens. Verify `just test-api` passes.
4. Delete `enableApiTestMode` flag, `API_TEST_TOKEN`, and the bypass branch in the guard. Update unit tests. Verify `just test-api` still passes.
5. Wire frontend `FRONTEND_FIREBASE_AUTH_EMULATOR_HOST` into `getFirebaseConfig` and `initFirebase`. Verify local dev login still works (against emulator).
6. Scaffold `e2e/` workspace with config + fixtures. Add one smoke test (`loginAs` + assert dashboard renders).
7. Add `docker-compose.e2e.yml` + Playwright runner image. Verify `just test-e2e` passes locally.
8. Add real-popup `auth-popup.spec.ts`.
9. Add CI step to pipeline running `just test-e2e`.

## Risks & Mitigations

- **Emulator host env var accidentally set in prod:** the gate (`*_ENABLE_MOCK_AUTH`) must also be true for the emulator path to activate. Backend additionally `delete`s `process.env.FIREBASE_AUTH_EMULATOR_HOST` when the gate is off, blocking the Admin SDK's auto-detection. Two independent failures required to misroute auth.
- **Gate accidentally enabled in prod:** caught by deployment review (`*_ENABLE_MOCK_AUTH=true` in prod env file is a glaring red flag) and a production smoke check that verifies real Firebase project ID is in use.
- **Emulator data persisted across CI runs:** wipe at suite start; emulator container has no volumes.
- **Real-popup test flake:** popup timing is the most fragile path. Mitigation: only one test uses it. If it flakes, we have signal that something real broke; if persistent flake comes from emulator UI changes, pin emulator version.
- **`signInWithEmailAndPassword` in fast path differs from prod's Google flow:** acceptable — the popup test covers the Google path; everything else just needs an authenticated session, not a specific provider.
- **`window.__e2eAuth` bundled in production JS:** the top-level `import { signInWithEmailAndPassword } from 'firebase/auth'` keeps the symbol referenced, so tree-shaking won't remove it. This is intentional — the code path that assigns `window.__e2eAuth` is only reached when the emulator gate flips on, and the four-key safety property above contains the worst-case blast radius. Production CI/CD deployment review is the primary control.

## Open Items

None. All decisions made; ready for implementation plan.
