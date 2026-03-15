# Plan 01: Project Infrastructure

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Redis to Docker Compose, install BullMQ and Firebase Admin SDK packages, extend `.env.template` with all new environment variables, and wire Firebase Admin SDK into a shared NestJS module so all subsequent feature plans can use it.

**Architecture:** Redis is added as a new Docker Compose service. BullMQ and Firebase Admin SDK are installed as backend dependencies. A `FirebaseModule` (global) initialises the Admin SDK once using env vars and exports an `app` instance for use in guards and services. No business logic is introduced in this plan.

**Tech Stack:** Docker Compose, Redis 7 Alpine, `bullmq`, `firebase-admin`, NestJS `@nestjs/bullmq`

**Spec reference:** `docs/superpowers/specs/2026-03-14-maintenance-tracker-design.md` — Section 2 (System Overview), Section 8 (Environment Variables)

---

## Chunk 1: Redis + Environment Variables

### Task 1: Add Redis service to Docker Compose

**Files:**
- Modify: `docker-compose.yml`
- Modify: `.env.template`

- [ ] **Step 1: Add Redis service to `docker-compose.yml`**

Add the following service block after the `postgres` service:

```yaml
  redis:
    image: redis:7-alpine
    ports:
      - '${REDIS_PORT:-6379}:6379'
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5
```

Update the `server` service `depends_on` block to include Redis:

```yaml
    depends_on:
      postgres:
        condition: service_healthy
        restart: true
      redis:
        condition: service_healthy
        restart: true
```

Also update the worker service (to be added in Plan 8 — leave a commented placeholder now):

```yaml
  # worker:
  #   (added in Plan 08 - Background Job Infrastructure)
```

- [ ] **Step 2: Add all new environment variables to `.env.template`**

Append to `.env.template`:

```dotenv
# Redis
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Email provider
EMAIL_PROVIDER=postmark
POSTMARK_API_KEY=your-postmark-api-key
POSTMARK_FROM_ADDRESS=no-reply@yourdomain.com
AWS_SES_REGION=us-east-1
AWS_SES_FROM_ADDRESS=no-reply@yourdomain.com

# Maintenance thresholds
MILEAGE_WARNING_THRESHOLD_KM=500
NOTIFICATION_DAYS_BEFORE=7
NOTIFICATION_CRON_SCHEDULE=0 8 * * *
```

- [ ] **Step 3: Verify Redis starts**

```bash
just up-build
docker ps
```

Expected: `maintenance-tracker-redis-1` is running and healthy.

```bash
docker exec maintenance-tracker-redis-1 redis-cli ping
```

Expected output: `PONG`

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml .env.template
git commit -m "feat: add Redis service to Docker Compose and extend env template"
```

---

## Chunk 2: Install Backend Packages

### Task 2: Install BullMQ, Firebase Admin SDK, and Postmark packages

**Files:**
- Modify: `backend/package.json` (via pnpm install)

- [ ] **Step 1: Install production dependencies**

```bash
cd backend && pnpm add @nestjs/bullmq bullmq firebase-admin postmark @aws-sdk/client-ses
```

- [ ] **Step 2: Verify packages are installed**

```bash
cd backend && node -e "require('@nestjs/bullmq'); require('firebase-admin'); require('postmark'); console.log('OK')"
```

Expected output: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/package.json pnpm-lock.yaml
git commit -m "feat: install bullmq, firebase-admin, postmark, aws-sdk packages"
```

---

## Chunk 3: Firebase Admin Module

### Task 3: Create FirebaseModule

**Files:**
- Create: `backend/src/modules/firebase/firebase.module.ts`
- Create: `backend/src/modules/firebase/firebase.service.ts`
- Create: `backend/src/modules/firebase/firebase.service.spec.ts`
- Modify: `backend/src/modules/app/app.module.ts`

**What this does:**
- `FirebaseService` initialises the Firebase Admin `app` instance once using env vars and exposes it.
- `FirebaseModule` is declared `@Global()` so all modules can inject `FirebaseService` without re-importing.

- [ ] **Step 1: Write the failing test**

Create `backend/src/modules/firebase/firebase.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest';

// Mock firebase-admin before importing FirebaseService to avoid real SDK validation
const mockApp = { name: 'test-app' };
const mockApps: unknown[] = [];
vi.mock('firebase-admin', () => ({
  default: {
    apps: mockApps,
    app: () => mockApp,
    initializeApp: vi.fn(() => {
      mockApps.push(mockApp);
      return mockApp;
    }),
    credential: {
      cert: vi.fn((creds) => creds),
    },
  },
}));

import { FirebaseService } from './firebase.service';

describe('FirebaseService', () => {
  let service: FirebaseService;

  const mockConfigService = {
    getOrThrow: (key: string) => {
      const values: Record<string, string> = {
        FIREBASE_PROJECT_ID: 'test-project',
        FIREBASE_CLIENT_EMAIL: 'test@test-project.iam.gserviceaccount.com',
        FIREBASE_PRIVATE_KEY: 'fake-private-key',
      };
      return values[key];
    },
  };

  beforeEach(async () => {
    // Reset mock app registry between tests
    mockApps.length = 0;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FirebaseService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<FirebaseService>(FirebaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should expose a Firebase app instance', () => {
    expect(service.app).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend && pnpm exec vitest run src/modules/firebase/firebase.service.spec.ts
```

Expected: FAIL — `FirebaseService` not found.

- [ ] **Step 3: Create `FirebaseService`**

Create `backend/src/modules/firebase/firebase.service.ts`:

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private _app: admin.app.App;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const projectId = this.configService.getOrThrow<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.getOrThrow<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.configService
      .getOrThrow<string>('FIREBASE_PRIVATE_KEY')
      .replace(/\\n/g, '\n');

    // Prevent re-initialisation if app already exists (e.g. in tests)
    if (admin.apps.length > 0) {
      this._app = admin.app();
      return;
    }

    this._app = admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  }

  get app(): admin.app.App {
    return this._app;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd backend && pnpm exec vitest run src/modules/firebase/firebase.service.spec.ts
```

Expected: PASS

- [ ] **Step 5: Create `FirebaseModule`**

Create `backend/src/modules/firebase/firebase.module.ts`:

```typescript
import { Global, Module } from '@nestjs/common';
import { FirebaseService } from './firebase.service';

@Global()
@Module({
  providers: [FirebaseService],
  exports: [FirebaseService],
})
export class FirebaseModule {}
```

- [ ] **Step 6: Register `FirebaseModule` in `AppModule`**

In `backend/src/modules/app/app.module.ts`, add `FirebaseModule` to the `imports` array and add the import statement at the top:

```typescript
import { FirebaseModule } from '../firebase/firebase.module';
```

Add `FirebaseModule` to the `imports` array alongside the existing imports. Do not replace the file — only add the new import.

- [ ] **Step 7: Run all unit tests to confirm nothing is broken**

```bash
just test-unit
```

Expected: All tests pass.

- [ ] **Step 8: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [ ] **Step 9: Commit**

```bash
git add backend/src/modules/firebase/
git add backend/src/modules/app/app.module.ts
git commit -m "feat: add FirebaseModule with Admin SDK initialisation"
```
