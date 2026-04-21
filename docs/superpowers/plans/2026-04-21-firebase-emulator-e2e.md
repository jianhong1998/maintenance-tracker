# Firebase Auth Emulator + Playwright E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `api-test-token` bypass with a Firebase Auth Emulator running in Docker, so the existing `api-test/` and a new `e2e/` Playwright workspace exercise the real auth path against an emulator-issued ID token.

**Architecture:** Emulator container runs alongside `postgres`/`server`/`client`. Backend Admin SDK auto-routes `verifyIdToken` to the emulator when the `BACKEND_ENABLE_MOCK_AUTH` gate is on, frontend calls `connectAuthEmulator` when `FRONTEND_ENABLE_MOCK_AUTH` is on. Each E2E test mints a unique user via the emulator's open REST endpoint — no shared-state contention, parallel-safe.

**Tech Stack:** firebase-tools (emulator), firebase-admin (backend), firebase/auth (frontend), Playwright (E2E), Docker Compose, NestJS, Next.js, Vitest.

**Spec reference:** `docs/superpowers/specs/2026-04-21-firebase-emulator-e2e-design.md`

---

## Conventions enforced throughout

- **Husky pre-commit hook auto-prepends the prefix** (e.g. `feat: 000 - <message>`). Always commit with the **bare description only**. Never include `feat:` / `fix:` etc. yourself.
- After every code edit run `just format` and `just lint` from repo root.
- TDD: write the failing test first, run it, watch it fail, then implement the minimum to make it pass.
- No TypeScript enums — use `as const` arrays or `const` objects.
- For NestJS classes that use `@project/types` in decorated method signatures, use `import type { … } from '@project/types'`.
- Functions with >2 parameters group params in a single object.

---

## File map

### Created
- `docker/firebase/firebase.json` — emulator config
- `docker/firebase/.firebaserc` — emulator project alias
- `docker/local/Dockerfile.firebase-emulator` — pinned firebase-tools image
- `docker/local/Dockerfile.playwright` — Playwright runner image
- `docker-compose.e2e.yml` — overlay adding the Playwright runner
- `e2e/package.json`, `e2e/tsconfig.json`, `e2e/playwright.config.ts`, `e2e/eslint.config.mjs`, `e2e/.gitignore`
- `e2e/src/fixtures/emulator.ts` — REST helpers
- `e2e/src/fixtures/auth.fixture.ts` — Playwright fixture exposing `loginAs`
- `e2e/src/global-setup.ts` — wipe emulator + reset DB
- `e2e/src/tests/smoke.spec.ts` — first end-to-end smoke
- `e2e/src/tests/auth-popup.spec.ts` — real-popup login test

### Modified
- `.env.template` — add gate + emulator host vars; remove `BACKEND_ENABLE_API_TEST_MODE`
- `.env.pipeline` — same
- `docker-compose.yml` — add `firebase-emulator` service
- `docker-compose.pipeline.yml` — same
- `pnpm-workspace.yaml` — register `e2e`
- `Justfile` — add `test-e2e`, `emulator-wipe`
- `.circleci/config.yml` — add `e2e-test` job
- `backend/src/modules/firebase/firebase.service.ts` — gate the emulator host
- `backend/src/modules/firebase/firebase.service.spec.ts` — cover both modes
- `backend/src/modules/auth/guards/firebase-auth.guard.ts` — delete bypass
- `backend/src/modules/auth/guards/firebase-auth.guard.spec.ts` — drop bypass tests
- `backend/src/modules/common/utils/environment-variable.util.ts` — drop `enableApiTestMode`
- `backend/src/modules/common/utils/environment-variable.util.spec.ts` — drop the matching tests
- `backend/src/modules/config/config.controller.spec.ts` — drop `enableApiTestMode` references
- `frontend/src/actions/firebase-config.ts` — add `authEmulatorHost`, gated by `FRONTEND_ENABLE_MOCK_AUTH`
- `frontend/src/actions/firebase-config.spec.ts` — extend
- `frontend/src/lib/firebase.ts` — accept `authEmulatorHost`, call `connectAuthEmulator`, expose `window.__e2eAuth.signIn` when emulator on
- `frontend/src/lib/firebase.spec.ts` — extend
- `api-test/src/helpers/auth.ts` — new file (mint emulator token)
- `api-test/src/tests/vehicles.spec.ts` — replace hardcoded token
- `api-test/src/tests/maintenance-cards.spec.ts` — replace hardcoded token
- `api-test/src/tests/health-check.spec.ts` — verify still works (no auth)

---

## Phase 1 — Emulator container

### Task 1: Create the Firebase emulator config

**Files:**
- Create: `docker/firebase/firebase.json`
- Create: `docker/firebase/.firebaserc`

- [ ] **Step 1: Create `docker/firebase/firebase.json`**

```json
{
  "emulators": {
    "auth": {
      "host": "0.0.0.0",
      "port": 9099
    },
    "ui": {
      "enabled": false
    },
    "singleProjectMode": false
  }
}
```

- [ ] **Step 2: Create `docker/firebase/.firebaserc`**

```json
{
  "projects": {
    "default": "maintenance-tracker-e2e"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add docker/firebase/
git commit -m "add firebase emulator config files"
```

---

### Task 2: Create Dockerfile for the emulator

**Files:**
- Create: `docker/local/Dockerfile.firebase-emulator`

- [ ] **Step 1: Write the Dockerfile**

```dockerfile
# Pinned firebase-tools version. Bump deliberately, never via `latest`.
FROM node:20-alpine

# OpenJDK is required by the Firebase Auth emulator.
RUN apk add --no-cache openjdk17-jre-headless curl bash

RUN npm install -g firebase-tools@13.29.1

WORKDIR /firebase
COPY docker/firebase/firebase.json ./firebase.json
COPY docker/firebase/.firebaserc ./.firebaserc

EXPOSE 9099

# --project must match .firebaserc; --host 0.0.0.0 so it's reachable from
# other containers (and from the host when run with network_mode: host).
CMD ["firebase", "emulators:start", "--only", "auth", "--project", "maintenance-tracker-e2e"]
```

- [ ] **Step 2: Commit**

```bash
git add docker/local/Dockerfile.firebase-emulator
git commit -m "add firebase emulator dockerfile"
```

---

### Task 3: Add `firebase-emulator` service to base compose

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Append the service to `docker-compose.yml`**

Add this block after the `redis` service block (preserve existing services unchanged):

```yaml
  firebase-emulator:
    build:
      context: .
      dockerfile: ./docker/local/Dockerfile.firebase-emulator
    network_mode: host
    healthcheck:
      test: ['CMD', 'curl', '-fsS', 'http://localhost:9099/']
      interval: 5s
      timeout: 3s
      retries: 20
```

Then update both the `server` and `worker` services to depend on it (add the entry to each existing `depends_on:`):

```yaml
      firebase-emulator:
        condition: service_healthy
```

- [ ] **Step 2: Verify the file parses**

Run: `docker compose -f docker-compose.yml config --quiet`
Expected: exit 0, no output.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "wire firebase emulator into base compose"
```

---

### Task 4: Add the same service to the pipeline compose

**Files:**
- Modify: `docker-compose.pipeline.yml`

- [ ] **Step 1: Add the same `firebase-emulator` block (build context unchanged)**

```yaml
  firebase-emulator:
    build:
      context: .
      dockerfile: ./docker/local/Dockerfile.firebase-emulator
    network_mode: host
    healthcheck:
      test: ['CMD', 'curl', '-fsS', 'http://localhost:9099/']
      interval: 5s
      timeout: 3s
      retries: 20
```

Add `firebase-emulator: { condition: service_healthy }` to `depends_on:` of both `server` and `worker` (mirroring Task 3).

- [ ] **Step 2: Validate**

Run: `docker compose -f docker-compose.pipeline.yml config --quiet`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.pipeline.yml
git commit -m "wire firebase emulator into pipeline compose"
```

---

### Task 5: Update `.env.template` and `.env.pipeline`

**Files:**
- Modify: `.env.template`
- Modify: `.env.pipeline`

- [ ] **Step 1: Edit `.env.template`** — replace the `BACKEND_ENABLE_API_TEST_MODE` line and add the new vars

Replace:
```
BACKEND_ENABLE_API_TEST_MODE=false # Set to 'true' when running API test
```
with:
```
# Firebase Auth Emulator gate — must be false in production / staging
BACKEND_ENABLE_MOCK_AUTH=false
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
```

In the existing "Firebase Admin SDK" section, replace the placeholder values with values that work for the emulator out of the box for new clones:

```
FIREBASE_PROJECT_ID=maintenance-tracker-e2e
FIREBASE_CLIENT_EMAIL=placeholder@example.com
FIREBASE_PRIVATE_KEY="placeholder"
```

In the "Frontend related" section, add:
```
FRONTEND_ENABLE_MOCK_AUTH=false
FRONTEND_FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
```

- [ ] **Step 2: Edit `.env.pipeline`** — replace the `BACKEND_ENABLE_API_TEST_MODE=true` block

Replace:
```
# Backend feature flag
# Set to 'true' when running API test
BACKEND_ENABLE_API_TEST_MODE=true
```
with:
```
# Firebase Auth Emulator — pipeline always runs against the emulator
BACKEND_ENABLE_MOCK_AUTH=true
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
FRONTEND_ENABLE_MOCK_AUTH=true
FRONTEND_FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
FIREBASE_PROJECT_ID=maintenance-tracker-e2e
FIREBASE_CLIENT_EMAIL=placeholder@example.com
FIREBASE_PRIVATE_KEY=placeholder
FRONTEND_FIREBASE_API_KEY=placeholder
FRONTEND_FIREBASE_AUTH_DOMAIN=placeholder.firebaseapp.com
FRONTEND_FIREBASE_PROJECT_ID=maintenance-tracker-e2e
```

Also remove the corresponding lines in `.circleci/config.yml`'s "Generate .env from .env.pipeline" step that inject `FIREBASE_*` and `FRONTEND_FIREBASE_*` from CircleCI secrets, since the pipeline now uses placeholders. Drop these lines from the `cat >> .env <<EOF` block:

```
FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL=$FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY=$FIREBASE_PRIVATE_KEY
FRONTEND_FIREBASE_API_KEY=$FRONTEND_FIREBASE_API_KEY
FRONTEND_FIREBASE_AUTH_DOMAIN=$FRONTEND_FIREBASE_AUTH_DOMAIN
FRONTEND_FIREBASE_PROJECT_ID=$FRONTEND_FIREBASE_PROJECT_ID
```

(Keep `BACKEND_COOKIE_SECRET`, `POSTMARK_API_KEY`, `POSTMARK_FROM_ADDRESS`.)

> **Rollback note:** the CircleCI project-level env vars (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FRONTEND_FIREBASE_API_KEY`, `FRONTEND_FIREBASE_AUTH_DOMAIN`, `FRONTEND_FIREBASE_PROJECT_ID`) are **not** deleted from the CircleCI UI — only the injection lines in `config.yml` are removed. If the emulator rollout breaks CI, revert the `.circleci/config.yml` diff from this task and CI returns to the previous state without reconfiguring secrets.

- [ ] **Step 3: Commit**

```bash
git add .env.template .env.pipeline .circleci/config.yml
git commit -m "swap api-test-mode env vars for mock-auth gate"
```

---

### Task 6: Smoke check the emulator container

- [ ] **Step 1: Build and start only the emulator**

```bash
docker compose build firebase-emulator
docker compose up -d firebase-emulator
```

- [ ] **Step 2: Verify it responds**

```bash
curl -fsS http://localhost:9099/
```
Expected: HTTP 200 with body containing `"authEmulator"` or similar metadata.

- [ ] **Step 3: Stop it**

```bash
docker compose stop firebase-emulator
```

No commit — verification only.

---

## Phase 2 — Backend wiring

### Task 7: Add `BACKEND_ENABLE_MOCK_AUTH` to `EnvironmentVariableUtil`

The util keeps three feature flags after this task: `enableMockAuth`, `enableHistory`, `enableProfile`. The old `enableApiTestMode` will be removed in Phase 4 (after api-test migrates).

**Files:**
- Modify: `backend/src/modules/common/utils/environment-variable.util.ts`
- Modify: `backend/src/modules/common/utils/environment-variable.util.spec.ts`

- [ ] **Step 1: Add failing test** — append inside `describe('#getFeatureFlags', () => { ... })` in `environment-variable.util.spec.ts`:

```typescript
it('returns enableMockAuth=true when BACKEND_ENABLE_MOCK_AUTH is "true"', () => {
  mockConfigService.get.mockImplementation((key: string, def: string) => {
    if (key === 'BACKEND_ENABLE_MOCK_AUTH') return 'true';
    return def ?? 'false';
  });

  expect(util.getFeatureFlags().enableMockAuth).toBe(true);
});

it('returns enableMockAuth=false when BACKEND_ENABLE_MOCK_AUTH is not set', () => {
  mockConfigService.get.mockReturnValue(undefined);

  expect(util.getFeatureFlags().enableMockAuth).toBe(false);
});
```

- [ ] **Step 2: Run the test — confirm it fails**

```bash
cd backend && pnpm exec vitest run src/modules/common/utils/environment-variable.util.spec.ts
```
Expected: TypeScript error or failing assertion — `enableMockAuth` does not exist on the returned shape.

- [ ] **Step 3: Implement** — in `environment-variable.util.ts` add `enableMockAuth: boolean` to `IFeatureFlagList` (above `enableHistory`) and add the read inside `getFeatureFlags()`:

```typescript
type IFeatureFlagList = {
  enableMockAuth: boolean;
  enableApiTestMode: boolean;
  enableHistory: boolean;
  enableProfile: boolean;
};
```

```typescript
this.featureFlagList = {
  enableMockAuth:
    this.configService.get<string>('BACKEND_ENABLE_MOCK_AUTH', 'false') ===
    'true',
  enableApiTestMode:
    this.configService.get<string>('BACKEND_ENABLE_API_TEST_MODE', 'false') ===
    'true',
  enableHistory:
    this.configService.get<string>('BACKEND_ENABLE_HISTORY', 'false') ===
    'true',
  enableProfile:
    this.configService.get<string>('BACKEND_ENABLE_PROFILE', 'false') ===
    'true',
};
```

- [ ] **Step 4: Re-run the test**

```bash
cd backend && pnpm exec vitest run src/modules/common/utils/environment-variable.util.spec.ts
```
Expected: PASS.

- [ ] **Step 5: Run all backend tests** to make sure existing consumers still compile

```bash
cd backend && pnpm test
```
Expected: PASS (note: `config.controller.spec.ts` mocks return `{ enableApiTestMode, enableHistory, enableProfile }` shape — adjust those mocks to also include `enableMockAuth: false`).

- [ ] **Step 6: Update `config.controller.spec.ts`** — add `enableMockAuth: false,` to the two `mockReturnValue` objects inside `describe('#getFeatureFlag', ...)`.

- [ ] **Step 7: Re-run all backend tests**

```bash
cd backend && pnpm test
```
Expected: PASS.

- [ ] **Step 8: Format + lint + commit**

```bash
just format && just lint
git add backend/src/modules/common/utils/ backend/src/modules/config/config.controller.spec.ts
git commit -m "add enableMockAuth feature flag to backend env util"
```

---

### Task 8: Make `FirebaseService` gate the emulator host

**Files:**
- Modify: `backend/src/modules/firebase/firebase.service.ts`
- Modify: `backend/src/modules/firebase/firebase.service.spec.ts`

- [ ] **Step 1: Replace `firebase.service.spec.ts` with the expanded version**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('firebase-admin', () => {
  const mockApps: { name: string }[] = [];
  const adminModule = {
    apps: mockApps,
    initializeApp: vi.fn((_opts: unknown, name: string) => {
      const app = { name };
      mockApps.push(app);
      return app;
    }),
    credential: {
      cert: vi.fn((creds: unknown) => creds as Record<string, unknown>),
    },
  };
  return {
    default: adminModule,
    ...adminModule,
  };
});

import { FirebaseService } from './firebase.service';
import { EnvironmentVariableUtil } from 'src/modules/common/utils/environment-variable.util';

type EnvMap = Record<string, string | undefined>;

function buildModule(envValues: EnvMap, flags: { enableMockAuth: boolean }) {
  const configService = {
    getOrThrow: (key: string) => {
      const value = envValues[key];
      if (value === undefined)
        throw new Error(`getOrThrow called for missing key: ${key}`);
      return value;
    },
  };
  const envUtil = {
    getFeatureFlags: () => ({
      enableMockAuth: flags.enableMockAuth,
      enableApiTestMode: false,
      enableHistory: false,
      enableProfile: false,
    }),
  };
  return Test.createTestingModule({
    providers: [
      FirebaseService,
      { provide: ConfigService, useValue: configService },
      { provide: EnvironmentVariableUtil, useValue: envUtil },
    ],
  }).compile();
}

const baseEnv: EnvMap = {
  FIREBASE_PROJECT_ID: 'test-project',
  FIREBASE_CLIENT_EMAIL: 'test@test-project.iam.gserviceaccount.com',
  FIREBASE_PRIVATE_KEY: 'fake-private-key',
  FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099',
};

describe('FirebaseService', () => {
  afterEach(() => {
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
  });

  it('exposes a Firebase app instance with the correct name', async () => {
    const module: TestingModule = await buildModule(baseEnv, {
      enableMockAuth: false,
    });
    await module.init();
    const service = module.get<FirebaseService>(FirebaseService);
    expect(service.app.name).toBe('maintenance-tracker');
  });

  it('sets process.env.FIREBASE_AUTH_EMULATOR_HOST when mock auth is enabled', async () => {
    const module: TestingModule = await buildModule(baseEnv, {
      enableMockAuth: true,
    });
    await module.init();
    expect(process.env.FIREBASE_AUTH_EMULATOR_HOST).toBe('localhost:9099');
  });

  it('throws at startup when mock auth is enabled but FIREBASE_AUTH_EMULATOR_HOST is missing', async () => {
    const env = { ...baseEnv, FIREBASE_AUTH_EMULATOR_HOST: undefined };
    const module: TestingModule = await buildModule(env, {
      enableMockAuth: true,
    });
    await expect(module.init()).rejects.toThrow(
      /FIREBASE_AUTH_EMULATOR_HOST/,
    );
  });

  it('deletes process.env.FIREBASE_AUTH_EMULATOR_HOST when mock auth is disabled', async () => {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = 'leftover-from-other-tool:9099';
    const module: TestingModule = await buildModule(baseEnv, {
      enableMockAuth: false,
    });
    await module.init();
    expect(process.env.FIREBASE_AUTH_EMULATOR_HOST).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run — confirm three of the four tests fail**

```bash
cd backend && pnpm exec vitest run src/modules/firebase/firebase.service.spec.ts
```
Expected: the original "exposes a Firebase app instance" passes; the three new tests fail.

- [ ] **Step 3: Implement** — replace `firebase.service.ts` with:

```typescript
import {
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { EnvironmentVariableUtil } from 'src/modules/common/utils/environment-variable.util';

const FIREBASE_APP_NAME = 'maintenance-tracker';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private _app: admin.app.App | undefined;

  constructor(
    private readonly configService: ConfigService,
    private readonly envUtil: EnvironmentVariableUtil,
  ) {}

  onModuleInit(): void {
    this.applyEmulatorEnv();

    const projectId = this.configService.getOrThrow<string>(
      'FIREBASE_PROJECT_ID',
    );
    const clientEmail = this.configService.getOrThrow<string>(
      'FIREBASE_CLIENT_EMAIL',
    );
    const privateKey = this.configService
      .getOrThrow<string>('FIREBASE_PRIVATE_KEY')
      .replace(/\\n/g, '\n');

    const existing = admin.apps.find((a) => a?.name === FIREBASE_APP_NAME);
    if (existing) {
      this._app = existing;
      return;
    }

    this._app = admin.initializeApp(
      {
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      },
      FIREBASE_APP_NAME,
    );
  }

  // The Admin SDK auto-recognizes process.env.FIREBASE_AUTH_EMULATOR_HOST.
  // We control that env var explicitly here so the SDK can never silently
  // route to an emulator unless our gate is on AND we provide a host.
  private applyEmulatorEnv(): void {
    const { enableMockAuth } = this.envUtil.getFeatureFlags();
    if (enableMockAuth) {
      const host = this.configService.getOrThrow<string>(
        'FIREBASE_AUTH_EMULATOR_HOST',
      );
      process.env.FIREBASE_AUTH_EMULATOR_HOST = host;
    } else {
      delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    }
  }

  get app(): admin.app.App {
    if (!this._app) {
      throw new InternalServerErrorException('Firebase app is not initialised');
    }
    return this._app;
  }
}
```

- [ ] **Step 4: Re-run the spec**

```bash
cd backend && pnpm exec vitest run src/modules/firebase/firebase.service.spec.ts
```
Expected: PASS (4 tests).

- [ ] **Step 5: Run full backend suite**

```bash
cd backend && pnpm test
```
Expected: PASS.

- [ ] **Step 6: Format + lint + commit**

```bash
just format && just lint
git add backend/src/modules/firebase/
git commit -m "gate firebase emulator host via mock-auth flag"
```

---

## Phase 3 — Migrate `api-test/` to emulator-issued tokens

### Task 9: Add the auth helper to `api-test/`

**Files:**
- Create: `api-test/src/helpers/auth.ts`

- [ ] **Step 1: Write the helper**

```typescript
import { randomUUID } from 'node:crypto';
import axios from 'axios';

const PROJECT_ID = 'maintenance-tracker-e2e';
const EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? 'localhost:9099';

const SIGN_UP_URL = `http://${EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`;

type EmulatorSignUpResponse = {
  idToken: string;
  refreshToken: string;
  email: string;
  localId: string;
};

export type TestUser = {
  email: string;
  idToken: string;
  uid: string;
};

/**
 * Mints a fresh user via the Firebase Auth Emulator's open REST endpoint.
 * The emulator accepts any `key` query param. Returns an ID token suitable
 * for `Authorization: Bearer ...` against the backend (which is also pointed
 * at the same emulator).
 */
export async function createTestUser(): Promise<TestUser> {
  const email = `api-test-${randomUUID()}@test.local`;
  const password = 'test-password';

  const res = await axios.post<EmulatorSignUpResponse>(SIGN_UP_URL, {
    email,
    password,
    returnSecureToken: true,
  });

  return { email, idToken: res.data.idToken, uid: res.data.localId };
}

export function authHeaders(user: TestUser) {
  return { headers: { Authorization: `Bearer ${user.idToken}` } };
}

/** Wipes every user in the emulator. Call between suites if you need a clean slate. */
export async function wipeEmulator(): Promise<void> {
  await axios.delete(
    `http://${EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`,
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add api-test/src/helpers/
git commit -m "add emulator auth helper for api-test"
```

---

### Task 10: Migrate `api-test/src/tests/vehicles.spec.ts`

**Files:**
- Modify: `api-test/src/tests/vehicles.spec.ts`

- [ ] **Step 1: Replace the top of the file**

Replace lines 1–8:
```typescript
import axiosInstance from '../config/axios';
import type { IVehicleResDTO, IMaintenanceCardResDTO } from '@project/types';

const API_TEST_TOKEN = 'Bearer api-test-token';

function authHeaders() {
  return { headers: { Authorization: API_TEST_TOKEN } };
}
```

with:
```typescript
import axiosInstance from '../config/axios';
import type { IVehicleResDTO, IMaintenanceCardResDTO } from '@project/types';
import { createTestUser, authHeaders, type TestUser } from '../helpers/auth';

let user: TestUser;

beforeAll(async () => {
  user = await createTestUser();
});
```

- [ ] **Step 2: Replace every `authHeaders()` call** with `authHeaders(user)`

Use a single editor-side find/replace: `authHeaders()` → `authHeaders(user)`. Verify by grepping.

```bash
grep -n "authHeaders()" api-test/src/tests/vehicles.spec.ts || echo "all replaced"
```
Expected: `all replaced`.

- [ ] **Step 3: Bring up the stack and run the test file**

```bash
just up-build
# wait until services are healthy
cd api-test && pnpm exec vitest run src/tests/vehicles.spec.ts
```
Expected: all `vehicles.spec.ts` tests pass.

- [ ] **Step 4: Commit**

```bash
just format && just lint
git add api-test/src/tests/vehicles.spec.ts
git commit -m "migrate vehicles api-tests to emulator tokens"
```

---

### Task 11: Migrate `api-test/src/tests/maintenance-cards.spec.ts`

**Files:**
- Modify: `api-test/src/tests/maintenance-cards.spec.ts`

- [ ] **Step 1: Apply the same top-of-file replacement** as Task 10 Step 1.

- [ ] **Step 2: Replace every `authHeaders()` with `authHeaders(user)`** (verify with grep).

- [ ] **Step 3: Run the file**

```bash
cd api-test && pnpm exec vitest run src/tests/maintenance-cards.spec.ts
```
Expected: all tests pass.

- [ ] **Step 4: Run full api-test suite**

```bash
just test-api
```
Expected: PASS for vehicles, maintenance-cards, and health-check.

- [ ] **Step 5: Commit**

```bash
just format && just lint
git add api-test/src/tests/maintenance-cards.spec.ts
git commit -m "migrate maintenance-cards api-tests to emulator tokens"
```

---

## Phase 4 — Delete the bypass

### Task 12: Drop `enableApiTestMode` from `EnvironmentVariableUtil`

**Files:**
- Modify: `backend/src/modules/common/utils/environment-variable.util.ts`
- Modify: `backend/src/modules/common/utils/environment-variable.util.spec.ts`
- Modify: `backend/src/modules/config/config.controller.spec.ts`

- [ ] **Step 1: Delete the field from the type and the read in the util**

Remove `enableApiTestMode: boolean;` from `IFeatureFlagList` and the corresponding entry in `getFeatureFlags()`.

- [ ] **Step 2: Delete the two `enableApiTestMode` tests** from `environment-variable.util.spec.ts` (lines covering `BACKEND_ENABLE_API_TEST_MODE`).

- [ ] **Step 3: Remove `enableApiTestMode: false,` from the two `mockReturnValue` objects** in `config.controller.spec.ts`.

- [ ] **Step 4: Run backend tests**

```bash
cd backend && pnpm test
```
Expected: PASS — except `firebase-auth.guard.spec.ts` may now fail to compile because its mock still uses `enableApiTestMode`. That's addressed in Task 13.

If the only failures are in `firebase-auth.guard.spec.ts`, proceed.

- [ ] **Step 5: Commit**

```bash
just format && just lint
git add backend/src/modules/common/utils/ backend/src/modules/config/config.controller.spec.ts
git commit -m "drop enableApiTestMode flag from env util"
```

---

### Task 13: Remove the bypass branch from `FirebaseAuthGuard`

**Files:**
- Modify: `backend/src/modules/auth/guards/firebase-auth.guard.ts`
- Modify: `backend/src/modules/auth/guards/firebase-auth.guard.spec.ts`

- [ ] **Step 1: Replace `firebase-auth.guard.ts` with the simplified version**

```typescript
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { FirebaseService } from 'src/modules/firebase/firebase.service';
import { AuthService } from '../services/auth.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(FirebaseAuthGuard.name);

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let decoded: { uid: string; email?: string };
    try {
      decoded = await this.firebaseService.app.auth().verifyIdToken(token);
    } catch (error) {
      this.logger.warn('Token verification failed', error);
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await this.authService.resolveUser({
      firebaseUid: decoded.uid,
      email: decoded.email ?? '',
    });

    (request as Request & { user: unknown }).user = user;
    return true;
  }
}
```

- [ ] **Step 2: Replace `firebase-auth.guard.spec.ts`** — drop the `EnvironmentVariableUtil` mock and the `'API test mode'` describe block:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { FirebaseService } from 'src/modules/firebase/firebase.service';
import { AuthService } from '../services/auth.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

const mockVerifyIdToken = vi.fn();
const mockFirebaseService = {
  app: {
    auth: () => ({ verifyIdToken: mockVerifyIdToken }),
  },
};

const mockAuthService = {
  resolveUser: vi.fn(),
};

const mockReflector = {
  getAllAndOverride: vi.fn(),
};

function makeContext(authHeader?: string): ExecutionContext {
  const request = {
    headers: { authorization: authHeader },
    user: undefined as unknown,
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('FirebaseAuthGuard', () => {
  let guard: FirebaseAuthGuard;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockReflector.getAllAndOverride.mockReturnValue(false);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FirebaseAuthGuard,
        { provide: FirebaseService, useValue: mockFirebaseService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: Reflector, useValue: mockReflector },
      ],
    }).compile();

    guard = module.get<FirebaseAuthGuard>(FirebaseAuthGuard);
  });

  it('returns true immediately for public routes (skips auth)', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(true);
    const ctx = makeContext(undefined);
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
    expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
      IS_PUBLIC_KEY,
      [expect.anything(), expect.anything()],
    );
  });

  it('throws UnauthorizedException when Authorization header is missing', async () => {
    await expect(guard.canActivate(makeContext(undefined))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when token is invalid', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('invalid token'));
    await expect(
      guard.canActivate(makeContext('Bearer bad-token')),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('attaches resolved user to request and returns true for valid token', async () => {
    const decodedToken = { uid: 'firebase-uid-1', email: 'user@example.com' };
    const resolvedUser = {
      id: 'user-1',
      email: 'user@example.com',
      firebaseUid: 'firebase-uid-1',
    };
    mockVerifyIdToken.mockResolvedValue(decodedToken);
    mockAuthService.resolveUser.mockResolvedValue(resolvedUser);

    const ctx = makeContext('Bearer valid-token');
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    const request = ctx.switchToHttp().getRequest<{ user: unknown }>();
    expect(request.user).toEqual(resolvedUser);
  });
});
```

- [ ] **Step 3: Run backend tests**

```bash
cd backend && pnpm test
```
Expected: PASS.

- [ ] **Step 4: Run api-test again to confirm nothing broke**

```bash
just test-api
```
Expected: PASS.

- [ ] **Step 5: Format + lint + commit**

```bash
just format && just lint
git add backend/src/modules/auth/guards/
git commit -m "remove api-test-token bypass from firebase auth guard"
```

---

## Phase 5 — Frontend wiring

### Task 14: Extend `getFirebaseConfig` server action

**Files:**
- Modify: `frontend/src/actions/firebase-config.ts`
- Modify: `frontend/src/actions/firebase-config.spec.ts`

- [ ] **Step 1: Add failing tests** to `firebase-config.spec.ts`. Inside the `describe('getFirebaseConfig', ...)` block append:

```typescript
it('returns authEmulatorHost when FRONTEND_ENABLE_MOCK_AUTH=true and host is set', async () => {
  vi.stubEnv('FRONTEND_ENABLE_MOCK_AUTH', 'true');
  vi.stubEnv('FRONTEND_FIREBASE_AUTH_EMULATOR_HOST', 'localhost:9099');
  const { getFirebaseConfig } = await import('./firebase-config');
  const config = await getFirebaseConfig();
  expect(config.authEmulatorHost).toBe('localhost:9099');
});

it('omits authEmulatorHost when FRONTEND_ENABLE_MOCK_AUTH=false even if host is set', async () => {
  vi.stubEnv('FRONTEND_ENABLE_MOCK_AUTH', 'false');
  vi.stubEnv('FRONTEND_FIREBASE_AUTH_EMULATOR_HOST', 'localhost:9099');
  const { getFirebaseConfig } = await import('./firebase-config');
  const config = await getFirebaseConfig();
  expect(config.authEmulatorHost).toBeUndefined();
});

it('throws when FRONTEND_ENABLE_MOCK_AUTH=true but host is missing', async () => {
  vi.stubEnv('FRONTEND_ENABLE_MOCK_AUTH', 'true');
  vi.stubEnv('FRONTEND_FIREBASE_AUTH_EMULATOR_HOST', '');
  const { getFirebaseConfig } = await import('./firebase-config');
  await expect(getFirebaseConfig()).rejects.toThrow(
    /FRONTEND_FIREBASE_AUTH_EMULATOR_HOST/,
  );
});
```

- [ ] **Step 2: Run — confirm fail**

```bash
cd frontend && pnpm exec vitest run src/actions/firebase-config.spec.ts
```
Expected: 3 new tests fail.

- [ ] **Step 3: Implement** — replace `firebase-config.ts`:

```typescript
'use server';

export type FirebaseClientConfig = {
  apiKey: string | undefined;
  authDomain: string | undefined;
  projectId: string | undefined;
  authEmulatorHost: string | undefined;
};

export async function getFirebaseConfig(): Promise<FirebaseClientConfig> {
  const enableMockAuth = process.env.FRONTEND_ENABLE_MOCK_AUTH === 'true';

  let authEmulatorHost: string | undefined;
  if (enableMockAuth) {
    const host = process.env.FRONTEND_FIREBASE_AUTH_EMULATOR_HOST;
    if (!host) {
      throw new Error(
        'FRONTEND_ENABLE_MOCK_AUTH is true but FRONTEND_FIREBASE_AUTH_EMULATOR_HOST is not set',
      );
    }
    authEmulatorHost = host;
  }

  return {
    apiKey: process.env.FRONTEND_FIREBASE_API_KEY,
    authDomain: process.env.FRONTEND_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FRONTEND_FIREBASE_PROJECT_ID,
    authEmulatorHost,
  };
}
```

- [ ] **Step 4: Update existing test assertions** — the existing test `returns correct config shape when all env vars are set` asserts a 3-key object via `toEqual`. Update it to expect 4 keys with `authEmulatorHost: undefined` (since `FRONTEND_ENABLE_MOCK_AUTH` is unstubbed in that test):

```typescript
expect(config).toEqual({
  apiKey: 'test-api-key',
  authDomain: 'test.firebaseapp.com',
  projectId: 'test-project-id',
  authEmulatorHost: undefined,
});
```

- [ ] **Step 5: Re-run**

```bash
cd frontend && pnpm exec vitest run src/actions/firebase-config.spec.ts
```
Expected: all PASS.

- [ ] **Step 6: Format + lint + commit**

```bash
just format && just lint
git add frontend/src/actions/
git commit -m "add authEmulatorHost gated by mock-auth flag"
```

---

### Task 15: Update `initFirebase` to call `connectAuthEmulator` and expose the E2E sign-in helper

**Files:**
- Modify: `frontend/src/lib/firebase.ts`
- Modify: `frontend/src/lib/firebase.spec.ts`

- [ ] **Step 1: Add failing tests** — replace the `firebase.spec.ts` mock block and append two new tests:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase/app', () => ({
  getApps: vi.fn(() => []),
  initializeApp: vi.fn(() => ({ name: 'test-app' })),
}));

const mockConnectAuthEmulator = vi.fn();
const mockSignInWithEmailAndPassword = vi.fn();

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ name: 'test-auth' })),
  connectAuthEmulator: (...args: unknown[]) => mockConnectAuthEmulator(...args),
  signInWithEmailAndPassword: (...args: unknown[]) =>
    mockSignInWithEmailAndPassword(...args),
}));

const validConfig = {
  apiKey: 'test-key',
  authDomain: 'test.firebaseapp.com',
  projectId: 'test-project',
  authEmulatorHost: undefined as string | undefined,
};

describe('firebase', () => {
  beforeEach(() => {
    vi.resetModules();
    mockConnectAuthEmulator.mockReset();
    mockSignInWithEmailAndPassword.mockReset();
    // Clean up any window.__e2eAuth left over from a previous test
    if (typeof window !== 'undefined') {
      delete (window as unknown as { __e2eAuth?: unknown }).__e2eAuth;
    }
  });

  describe('initFirebase', () => {
    it('initializes and returns an Auth instance when config is valid', async () => {
      const { initFirebase } = await import('@/lib/firebase');
      const auth = initFirebase(validConfig);
      expect(auth).toBeDefined();
    });

    it('is idempotent — second call returns same instance without reinitializing', async () => {
      const { initFirebase } = await import('@/lib/firebase');
      const { initializeApp } = await import('firebase/app');
      vi.clearAllMocks();
      const auth1 = initFirebase(validConfig);
      const auth2 = initFirebase(validConfig);
      expect(auth1).toBe(auth2);
      expect(initializeApp).toHaveBeenCalledTimes(1);
    });

    it('throws with controlled message when apiKey is undefined', async () => {
      const { initFirebase } = await import('@/lib/firebase');
      expect(() => initFirebase({ ...validConfig, apiKey: undefined })).toThrow(
        'Missing required Firebase config: apiKey',
      );
    });

    it('throws with controlled message when multiple config values are undefined', async () => {
      const { initFirebase } = await import('@/lib/firebase');
      expect(() =>
        initFirebase({
          apiKey: undefined,
          authDomain: undefined,
          projectId: 'test',
          authEmulatorHost: undefined,
        }),
      ).toThrow('Missing required Firebase config');
    });

    it('does not call connectAuthEmulator when authEmulatorHost is undefined', async () => {
      const { initFirebase } = await import('@/lib/firebase');
      initFirebase(validConfig);
      expect(mockConnectAuthEmulator).not.toHaveBeenCalled();
    });

    it('calls connectAuthEmulator with http URL when authEmulatorHost is set', async () => {
      const { initFirebase } = await import('@/lib/firebase');
      initFirebase({ ...validConfig, authEmulatorHost: 'localhost:9099' });
      expect(mockConnectAuthEmulator).toHaveBeenCalledWith(
        expect.anything(),
        'http://localhost:9099',
        { disableWarnings: true },
      );
    });

    it('does not expose window.__e2eAuth when authEmulatorHost is undefined', async () => {
      const { initFirebase } = await import('@/lib/firebase');
      initFirebase(validConfig);
      expect(
        (window as unknown as { __e2eAuth?: unknown }).__e2eAuth,
      ).toBeUndefined();
    });

    it('exposes window.__e2eAuth.signIn when authEmulatorHost is set', async () => {
      const { initFirebase } = await import('@/lib/firebase');
      initFirebase({ ...validConfig, authEmulatorHost: 'localhost:9099' });
      const helper = (
        window as unknown as {
          __e2eAuth?: { signIn: (e: string, p: string) => Promise<void> };
        }
      ).__e2eAuth;
      expect(typeof helper?.signIn).toBe('function');
    });
  });

  describe('getFirebaseAuth', () => {
    it('throws before initFirebase is called', async () => {
      const { getFirebaseAuth } = await import('@/lib/firebase');
      expect(() => getFirebaseAuth()).toThrow(
        'Firebase has not been initialized',
      );
    });

    it('returns auth instance after initFirebase is called', async () => {
      const { initFirebase, getFirebaseAuth } = await import('@/lib/firebase');
      initFirebase(validConfig);
      expect(getFirebaseAuth()).toBeDefined();
    });
  });
});
```

- [ ] **Step 2: Run — confirm fails**

```bash
cd frontend && pnpm exec vitest run src/lib/firebase.spec.ts
```
Expected: 4 new tests fail (the two `connectAuthEmulator` assertions and the two `__e2eAuth` exposure assertions).

Sanity check before implementing: `beforeEach` resets modules (`vi.resetModules()`) **and** deletes `window.__e2eAuth` if present. Each test above calls `initFirebase` at most once on a freshly-imported module, so the `if (_auth) return _auth;` short-circuit in the implementation is not exercised mid-test. Do not merge the `__e2eAuth` tests back into a single two-call test — the module singleton would swallow the second call.

- [ ] **Step 3: Implement** — replace `firebase.ts`:

```typescript
import { getApps, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  signInWithEmailAndPassword,
  type Auth,
} from 'firebase/auth';

let _auth: Auth | null = null;

export type InitFirebaseConfig = {
  apiKey: string | undefined;
  authDomain: string | undefined;
  projectId: string | undefined;
  authEmulatorHost: string | undefined;
};

export function initFirebase(config: InitFirebaseConfig): Auth {
  if (_auth) return _auth;

  const required = {
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
  };
  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    throw new Error(`Missing required Firebase config: ${missing.join(', ')}`);
  }

  // getApps()[0] reuses an existing app (e.g. across HMR cycles in dev).
  const app = getApps().length === 0 ? initializeApp(required) : getApps()[0];
  _auth = getAuth(app);

  if (config.authEmulatorHost) {
    connectAuthEmulator(_auth, `http://${config.authEmulatorHost}`, {
      disableWarnings: true,
    });
    exposeE2ESignInHelper(_auth);
  }

  return _auth;
}

export function getFirebaseAuth(): Auth {
  if (!_auth)
    throw new Error(
      'Firebase has not been initialized. Call initFirebase() first.',
    );
  return _auth;
}

// Exposed only when the emulator gate is on. Production builds never reach
// this branch because authEmulatorHost is undefined unless FRONTEND_ENABLE_MOCK_AUTH
// is true on the server.
function exposeE2ESignInHelper(auth: Auth): void {
  if (typeof window === 'undefined') return;
  (window as unknown as {
    __e2eAuth: { signIn: (email: string, password: string) => Promise<void> };
  }).__e2eAuth = {
    signIn: async (email, password) => {
      await signInWithEmailAndPassword(auth, email, password);
    },
  };
}
```

- [ ] **Step 4: Re-run**

```bash
cd frontend && pnpm exec vitest run src/lib/firebase.spec.ts
```
Expected: PASS.

- [ ] **Step 5: Run all frontend tests**

```bash
cd frontend && pnpm test
```
Expected: PASS.

- [ ] **Step 6: Manual smoke check** — start the stack, confirm login still works against the emulator:

```bash
just up-build
# wait for healthcheck. Then in a browser open http://localhost:3000
# the login page loads; clicking Sign in with Google opens the emulator's
# stub picker. Pick or create a user, confirm you land on the dashboard.
```
If the dashboard loads, the wire-through works. Stop the stack with `just down`.

- [ ] **Step 7: Format + lint + commit**

```bash
just format && just lint
git add frontend/src/lib/
git commit -m "connect frontend to firebase auth emulator when gate is on"
```

---

## Phase 6 — `e2e/` workspace

### Task 16: Scaffold the workspace

**Files:**
- Create: `e2e/package.json`
- Create: `e2e/tsconfig.json`
- Create: `e2e/eslint.config.mjs`
- Create: `e2e/.gitignore`
- Create: `e2e/playwright.config.ts`
- Modify: `pnpm-workspace.yaml`

- [ ] **Step 1: Add `'e2e'` to `pnpm-workspace.yaml`**

```yaml
packages:
  - 'backend'
  - 'frontend'
  - 'api-test'
  - 'e2e'
  - 'packages/*'
```

- [ ] **Step 2: Create `e2e/package.json`**

```json
{
  "name": "e2e",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "test": "playwright test",
    "test:headed": "playwright test --headed",
    "lint": "eslint",
    "lint:fix": "eslint --fix",
    "format": "prettier . --write"
  },
  "dependencies": {
    "@playwright/test": "1.49.1",
    "axios": "1.14.0"
  },
  "devDependencies": {
    "@eslint/eslintrc": "^3.3.1",
    "@eslint/js": "^9.34.0",
    "@types/node": "^24.3.0",
    "eslint": "^9.34.0",
    "eslint-config-prettier": "^10.1.8",
    "eslint-plugin-prettier": "^5.5.4",
    "globals": "^16.3.0",
    "prettier": "^3.6.2",
    "typescript": "^5.9.2",
    "typescript-eslint": "^8.41.0"
  }
}
```

- [ ] **Step 3: Create `e2e/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*", "playwright.config.ts"]
}
```

- [ ] **Step 4: Create `e2e/eslint.config.mjs`** — copy from `api-test/eslint.config.mjs` verbatim. Read it first:

```bash
cat api-test/eslint.config.mjs
```
Then write the same contents to `e2e/eslint.config.mjs`.

- [ ] **Step 5: Create `e2e/.gitignore`**

```
node_modules
playwright-report
test-results
.turbo
```

- [ ] **Step 6: Create `e2e/playwright.config.ts`**

```typescript
import { defineConfig, devices } from '@playwright/test';

const FRONTEND_URL = process.env.E2E_FRONTEND_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './src/tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './src/global-setup.ts',
  use: {
    baseURL: FRONTEND_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
```

- [ ] **Step 7: Install dependencies and Playwright browsers**

```bash
just install
cd e2e && pnpm exec playwright install chromium --with-deps
```
Expected: Playwright downloads Chromium (~150MB) and reports success.

- [ ] **Step 8: Commit**

```bash
git add pnpm-workspace.yaml e2e/ pnpm-lock.yaml
git commit -m "scaffold e2e workspace with playwright"
```

---

### Task 17: Add the emulator REST helpers

**Files:**
- Create: `e2e/src/fixtures/emulator.ts`

- [ ] **Step 1: Write the helpers**

```typescript
import { randomUUID } from 'node:crypto';
import axios from 'axios';

const PROJECT_ID =
  process.env.E2E_FIREBASE_PROJECT_ID ?? 'maintenance-tracker-e2e';
const EMULATOR_HOST =
  process.env.E2E_FIREBASE_AUTH_EMULATOR_HOST ?? 'localhost:9099';

const SIGN_UP_URL = `http://${EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`;
const WIPE_URL = `http://${EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`;

export type EmulatorUser = {
  email: string;
  password: string;
  uid: string;
  idToken: string;
};

export async function createEmulatorUser(): Promise<EmulatorUser> {
  const email = `e2e-${randomUUID()}@test.local`;
  const password = 'test-password';
  const res = await axios.post<{ idToken: string; localId: string }>(
    SIGN_UP_URL,
    { email, password, returnSecureToken: true },
  );
  return { email, password, uid: res.data.localId, idToken: res.data.idToken };
}

export async function wipeEmulator(): Promise<void> {
  await axios.delete(WIPE_URL);
}
```

- [ ] **Step 2: Commit**

```bash
git add e2e/src/fixtures/emulator.ts
git commit -m "add emulator rest helpers for e2e"
```

---

### Task 18: Add the `loginAs` Playwright fixture

**Files:**
- Create: `e2e/src/fixtures/auth.fixture.ts`

- [ ] **Step 1: Write the fixture**

```typescript
import { test as base, type Page } from '@playwright/test';
import { createEmulatorUser, type EmulatorUser } from './emulator';

type AuthFixtures = {
  loginAs: (page: Page) => Promise<EmulatorUser>;
};

export const test = base.extend<AuthFixtures>({
  loginAs: async ({}, use) => {
    await use(async (page) => {
      const user = await createEmulatorUser();
      await page.goto('/login');
      // window.__e2eAuth is exposed by frontend/src/lib/firebase.ts when the
      // emulator is connected. Production builds do not expose it.
      await page.waitForFunction(
        () =>
          typeof (window as unknown as { __e2eAuth?: unknown }).__e2eAuth !==
          'undefined',
      );
      await page.evaluate(
        async ({ email, password }) => {
          await (
            window as unknown as {
              __e2eAuth: {
                signIn: (e: string, p: string) => Promise<void>;
              };
            }
          ).__e2eAuth.signIn(email, password);
        },
        { email: user.email, password: user.password },
      );
      await page.waitForURL((url) => !url.pathname.startsWith('/login'));
      return user;
    });
  },
});

export { expect } from '@playwright/test';
```

- [ ] **Step 2: Commit**

```bash
git add e2e/src/fixtures/auth.fixture.ts
git commit -m "add loginAs playwright fixture"
```

---

### Task 19: Add global setup (wipe emulator + reset DB)

**Files:**
- Create: `e2e/src/global-setup.ts`

- [ ] **Step 1: Write it**

```typescript
import { execSync } from 'node:child_process';
import { wipeEmulator } from './fixtures/emulator';

export default async function globalSetup() {
  // 1. Wipe all emulator users so test runs start from a clean slate.
  await wipeEmulator();

  // 2. Reset the database. We delegate to the existing just recipe rather
  // than re-implementing it here. This requires the host to have `just`
  // available — true in dev and in the CI machine executor.
  if (process.env.E2E_SKIP_DB_RESET !== 'true') {
    execSync('just db-data-reset', { stdio: 'inherit' });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add e2e/src/global-setup.ts
git commit -m "add e2e global setup that wipes emulator and resets db"
```

---

### Task 20: Add the smoke test

**Files:**
- Create: `e2e/src/tests/smoke.spec.ts`

- [ ] **Step 1: Write a single end-to-end smoke**

```typescript
import { test, expect } from '../fixtures/auth.fixture';

test('user can log in and see the dashboard shell', async ({
  page,
  loginAs,
}) => {
  await loginAs(page);
  // Dashboard shell renders the Fleet nav item — assert it's visible.
  await expect(
    page.getByRole('link', { name: /fleet/i }).first(),
  ).toBeVisible();
});
```

- [ ] **Step 2: Run it locally** — bring up the stack first, then run the test from the host:

```bash
just up-build
# wait for healthchecks, ~30s
cd e2e && pnpm test src/tests/smoke.spec.ts
```
Expected: 1 test passes.

- [ ] **Step 3: Commit**

```bash
just format && just lint
git add e2e/src/tests/smoke.spec.ts
git commit -m "add e2e smoke test"
```

---

### Task 21: Add the real-popup login test

**Files:**
- Create: `e2e/src/tests/auth-popup.spec.ts`

- [ ] **Step 1: Write the test** — drives the real `signInWithPopup(GoogleAuthProvider)` flow against the emulator's stub picker page.

```typescript
import { test, expect } from '@playwright/test';

test('user can sign in via Google popup against the emulator', async ({
  page,
  context,
}) => {
  await page.goto('/login');

  const popupPromise = context.waitForEvent('page');
  await page.getByRole('button', { name: /sign in with google/i }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');

  // Emulator stub picker exposes an "Add new account" button that opens a
  // form to create a Google identity on the fly.
  await popup.getByRole('button', { name: /add new account/i }).click();
  const email = `popup-${Date.now()}@test.local`;
  await popup.getByLabel(/email/i).fill(email);
  await popup.getByLabel(/display name/i).fill('Popup Tester');
  await popup
    .getByRole('button', { name: /sign in with google\.com/i })
    .click();
  await popup.waitForEvent('close');

  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
  await expect(
    page.getByRole('link', { name: /fleet/i }).first(),
  ).toBeVisible();
});
```

> **Note:** The exact button labels in the emulator picker are versioned with `firebase-tools`. If your pinned version (Task 2) renders different labels, adjust the selectors. Run the test in headed mode to see the picker:
> ```bash
> cd e2e && pnpm test:headed src/tests/auth-popup.spec.ts
> ```

- [ ] **Step 2: Run the test**

```bash
cd e2e && pnpm test src/tests/auth-popup.spec.ts
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
just format && just lint
git add e2e/src/tests/auth-popup.spec.ts
git commit -m "add real-popup login e2e test"
```

---

## Phase 7 — Containerised E2E run + Justfile

### Task 22: Create the Playwright Dockerfile

**Files:**
- Create: `docker/local/Dockerfile.playwright`

- [ ] **Step 1: Write it**

```dockerfile
FROM mcr.microsoft.com/playwright:v1.49.1-jammy

# Install pnpm (matches CircleCI install)
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Install just so global-setup can call `just db-data-reset`
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh \
       | bash -s -- --to /usr/local/bin \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY api-test/package.json ./api-test/
COPY e2e/package.json ./e2e/

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .

WORKDIR /app/e2e

# E2E_SKIP_DB_RESET=true because the pipeline resets the DB outside this
# container (the migration service already starts from a clean Postgres).
ENV E2E_SKIP_DB_RESET=true
ENV E2E_FRONTEND_URL=http://localhost:3000
ENV E2E_FIREBASE_AUTH_EMULATOR_HOST=localhost:9099

CMD ["pnpm", "test"]
```

- [ ] **Step 2: Commit**

```bash
git add docker/local/Dockerfile.playwright
git commit -m "add playwright runner dockerfile"
```

---

### Task 23: Create `docker-compose.e2e.yml`

**Files:**
- Create: `docker-compose.e2e.yml`

- [ ] **Step 1: Write the overlay**

```yaml
services:
  playwright-runner:
    build:
      context: .
      dockerfile: ./docker/local/Dockerfile.playwright
    network_mode: host
    env_file: ./.env
    depends_on:
      postgres:
        condition: service_healthy
      firebase-emulator:
        condition: service_healthy
      server:
        condition: service_started
      client:
        condition: service_started
      db-migration-service:
        condition: service_completed_successfully
    volumes:
      - ./e2e/playwright-report:/app/e2e/playwright-report
      - ./e2e/test-results:/app/e2e/test-results
```

- [ ] **Step 2: Validate**

```bash
docker compose -f docker-compose.yml -f docker-compose.e2e.yml config --quiet
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.e2e.yml
git commit -m "add docker-compose.e2e.yml overlay for playwright runner"
```

---

### Task 24: Add `just test-e2e` and `just emulator-wipe`

**Files:**
- Modify: `Justfile`

- [ ] **Step 1: Add the two recipes** under the `test` group:

```just
[group: 'test']
test-e2e:
    @docker compose \
        -p {{PROJECT_NAME}} \
        -f docker-compose.yml \
        -f docker-compose.e2e.yml \
        up --build --abort-on-container-exit playwright-runner

[group: 'test']
emulator-wipe:
    @curl -fsS -X DELETE \
        http://localhost:9099/emulator/v1/projects/maintenance-tracker-e2e/accounts && \
        echo "emulator wiped"
```

- [ ] **Step 2: Smoke test the local containerised run**

```bash
just test-e2e
```
Expected: stack boots, `playwright-runner` reports both tests pass, container exits 0.

- [ ] **Step 3: Commit**

```bash
git add Justfile
git commit -m "add test-e2e and emulator-wipe just recipes"
```

---

## Phase 8 — CircleCI integration

### Task 25: Add the `e2e-test` job to CircleCI

**Files:**
- Modify: `.circleci/config.yml`

- [ ] **Step 1: Add a new `e2e-test` job** under the existing `api-test` job (mirror its shape — same executor, same env-generation step, swap the `up`/test command):

```yaml
  e2e-test:
    executor: machine-executor
    resource_class: arm.large
    steps:
      - checkout
      - set-short-sha
      - ecr-login
      - install-pnpm
      - run:
          name: Install dependencies
          command: pnpm install --frozen-lockfile --ignore-scripts
      - run:
          name: Generate .env from .env.pipeline and CircleCI secrets
          command: |
            cp .env.pipeline .env
            cat >> .env \<< EOF
            BACKEND_COOKIE_SECRET=$BACKEND_COOKIE_SECRET
            POSTMARK_API_KEY=$POSTMARK_API_KEY
            POSTMARK_FROM_ADDRESS=$POSTMARK_FROM_ADDRESS
            EOF
      - run:
          name: Start services
          command: |
            docker compose \
              -f docker-compose.pipeline.yml \
              -f docker-compose.e2e.yml \
              up -d \
              postgres redis firebase-emulator db-migration-service server client worker
      - run:
          name: Wait for backend to be ready
          command: |
            timeout 120 bash -c 'until curl -sf http://localhost:3001/; do sleep 3; done'
      - run:
          name: Wait for frontend to be ready
          command: |
            timeout 120 bash -c 'until curl -sf http://localhost:3000/; do sleep 3; done'
      - run:
          name: Run E2E tests
          command: |
            docker compose \
              -f docker-compose.pipeline.yml \
              -f docker-compose.e2e.yml \
              run --rm playwright-runner
      - store_artifacts:
          path: e2e/playwright-report
          destination: playwright-report
      - run:
          name: Tear down services
          command: |
            docker compose \
              -f docker-compose.pipeline.yml \
              -f docker-compose.e2e.yml \
              down --volumes
          when: always
```

- [ ] **Step 2: Add `e2e-test` to both workflows**

In `branch-workflow`, add after the existing `api-test` job:
```yaml
      - e2e-test:
          context: aws-ecr-context
          requires:
            - build-and-push-backend
            - build-and-push-frontend
            - build-and-push-background-job
            - build-and-push-db-migration
```

And update `approve-deploy-to-dev`'s `requires` list to include `e2e-test`:
```yaml
      - approve-deploy-to-dev:
          type: approval
          requires:
            - api-test
            - e2e-test
```

In `tag-workflow`, do the same — add `e2e-test` after `api-test` (with the same `filters.tags.only` pattern as the other tag-gated jobs) and add `e2e-test` to `tag-prod-*` `requires:` lists.

- [ ] **Step 3: Validate the YAML locally**

```bash
docker run --rm -v "$PWD/.circleci:/workdir" --workdir /workdir cimg/base:current \
  bash -c 'curl -sSL -o /tmp/yq https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64 && chmod +x /tmp/yq && /tmp/yq eval "." config.yml > /dev/null'
```
Expected: exit 0 (yaml parses).

If `yq` access is unavailable, at minimum check with `python -c "import yaml; yaml.safe_load(open('.circleci/config.yml'))"`.

- [ ] **Step 4: Commit**

```bash
git add .circleci/config.yml
git commit -m "add e2e-test job to circleci pipeline"
```

---

## Phase 9 — Final cleanup

### Task 26: Update bug index and remove leftover hardcoded constants

**Files:**
- Search check only

- [ ] **Step 1: Confirm no orphan references to the old bypass remain**

```bash
grep -rn "api-test-token\|API_TEST_TOKEN\|enableApiTestMode\|BACKEND_ENABLE_API_TEST_MODE" \
  backend/src api-test/src frontend/src e2e/src .env.template .env.pipeline .circleci/
```
Expected: **no output**. If anything turns up, remove it (or, if it's a deliberate historical reference inside `docs/`, leave it alone — only check code/config).

- [ ] **Step 2: Run every check**

```bash
just format
just lint
cd backend && pnpm test
cd frontend && pnpm test
just up-build  # in another terminal, leave running
just test-api
just test-e2e
```
All should pass.

- [ ] **Step 3: Final commit (only if anything was edited)**

```bash
git add -A
git status # review
git commit -m "remove residual api-test-token references"
```

---

## Self-review notes

- **Spec coverage:** every numbered item in the spec's "Migration Sequence" maps to one or more tasks above (Tasks 1–6 → step 1; 7–8 → step 2; 9–11 → step 3; 12–13 → step 4; 14–15 → step 5; 16–20 → step 6; 22–24 → step 7; 21 → step 8; 25 → step 9).
- **Two-key safety:** Task 8 implements the active `delete process.env.FIREBASE_AUTH_EMULATOR_HOST` and Task 14 enforces the same pattern on the frontend.
- **Husky reminder:** every commit step uses bare descriptions only.
- **No placeholders:** every code block is complete; no "TODO" or "TBD".
- **Type consistency:** `EmulatorUser` (e2e), `TestUser` (api-test), `InitFirebaseConfig` (frontend), `IFeatureFlagList` (backend) are each defined where they're first used and referenced consistently afterwards.
- **One file per responsibility:** emulator REST helpers, auth fixture, global-setup, and tests are each isolated; production code paths only branch on the explicit gate.
