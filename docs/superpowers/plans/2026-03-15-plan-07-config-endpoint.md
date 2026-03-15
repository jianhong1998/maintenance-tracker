# Plan 07: Config Endpoint (`GET /config`)

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a public `GET /config` endpoint that exposes environment-controlled thresholds (`MILEAGE_WARNING_THRESHOLD_KM`, `NOTIFICATION_DAYS_BEFORE`) to the frontend. The frontend uses these values to colour-code maintenance cards and to understand the notification lead-time window.

**Architecture:** A new `ConfigModule` is added under `backend/src/modules/config/`. Its single `ConfigController` reads directly from NestJS `ConfigService` (already global via `AppConfig.configModule`) — no service class needed. The route is public: a new `@Public()` decorator sets `IS_PUBLIC_KEY` metadata, and `FirebaseAuthGuard.canActivate` checks that metadata via `Reflector` before attempting token verification. On the frontend, a `useAppConfig` TanStack Query hook fetches the endpoint with `staleTime: Infinity` — config values are env-controlled and do not change at runtime.

**Tech Stack:** NestJS (`@nestjs/config` `ConfigService`, `Reflector`, `SetMetadata`), `@project/types`, TanStack Query, axios

**Spec reference:** `docs/superpowers/specs/2026-03-14-maintenance-tracker-design.md` — Section 4 (Config API), Section 5 (Mileage Warning — Frontend Only), Section 8 (Environment Variables)

**Prerequisites:** Plans 01–06 must be complete (specifically Plan 03 for `FirebaseAuthGuard` and `AuthModule`).

---

## Chunk 1: Shared Types

### Task 1: Add `IAppConfigResDTO` to `@project/types`

**Files:**
- Create: `packages/types/src/dtos/config.dto.ts`
- Modify: `packages/types/src/dtos/index.ts`

- [ ] **Step 1: Create `config.dto.ts`**

Create `packages/types/src/dtos/config.dto.ts`:

```typescript
export interface IAppConfigResDTO {
  mileageWarningThresholdKm: number;
}
```

- [ ] **Step 2: Re-export from `packages/types/src/dtos/index.ts`**

Add to `packages/types/src/dtos/index.ts`:

```typescript
export * from './config.dto';
```

- [ ] **Step 3: Build `@project/types`**

```bash
cd packages/types && pnpm run build
```

Expected: No TypeScript errors, `dist/` is updated.

- [ ] **Step 4: Commit**

```bash
git add packages/types/src/dtos/config.dto.ts packages/types/src/dtos/index.ts
git commit -m "feat: add IAppConfigResDTO shared type"
```

---

## Chunk 2: Public Route Decorator and Guard Update

### Task 2: Create `@Public()` decorator

**Files:**
- Create: `backend/src/modules/auth/decorators/public.decorator.ts`

- [ ] **Step 1: Create `public.decorator.ts`**

Create `backend/src/modules/auth/decorators/public.decorator.ts`:

```typescript
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

No test is required for this file — it is a one-liner wrapper around NestJS's own `SetMetadata`. Its correctness is validated through the guard test in Task 3.

- [ ] **Step 2: Commit**

```bash
git add backend/src/modules/auth/decorators/public.decorator.ts
git commit -m "feat: add @Public() decorator for bypassing auth guard"
```

---

### Task 3: Update `FirebaseAuthGuard` to respect `@Public()`

**Files:**
- Modify: `backend/src/modules/auth/guards/firebase-auth.guard.ts`
- Modify: `backend/src/modules/auth/guards/firebase-auth.guard.spec.ts`

- [ ] **Step 1: Write the failing tests**

Replace the contents of `backend/src/modules/auth/guards/firebase-auth.guard.spec.ts` with:

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
    expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      expect.anything(),
      expect.anything(),
    ]);
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

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend && pnpm exec vitest run src/modules/auth/guards/firebase-auth.guard.spec.ts
```

Expected: FAIL — `Reflector` not in providers, public route test fails.

- [ ] **Step 3: Update `FirebaseAuthGuard`**

Replace the contents of `backend/src/modules/auth/guards/firebase-auth.guard.ts` with:

```typescript
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { FirebaseService } from 'src/modules/firebase/firebase.service';
import { AuthService } from '../services/auth.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
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
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];

    let decoded: { uid: string; email?: string };
    try {
      decoded = await this.firebaseService.app.auth().verifyIdToken(token);
    } catch {
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

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd backend && pnpm exec vitest run src/modules/auth/guards/firebase-auth.guard.spec.ts
```

Expected: PASS — all 4 tests pass.

- [ ] **Step 5: Run all unit tests**

```bash
just test-unit
```

Expected: All tests pass.

- [ ] **Step 6: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/auth/guards/firebase-auth.guard.ts \
        backend/src/modules/auth/guards/firebase-auth.guard.spec.ts
git commit -m "feat: update FirebaseAuthGuard to skip auth for @Public() routes"
```

---

## Chunk 3: ConfigModule (Backend)

### Task 4: Create `ConfigController` and `ConfigModule`

**Files:**
- Create: `backend/src/modules/config/config.controller.ts`
- Create: `backend/src/modules/config/config.controller.spec.ts`
- Create: `backend/src/modules/config/config.module.ts`
- Modify: `backend/src/modules/app/app.module.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/modules/config/config.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ConfigController } from './config.controller';

const mockConfigService = {
  get: vi.fn(),
};

describe('ConfigController', () => {
  let controller: ConfigController;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConfigController],
      providers: [
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<ConfigController>(ConfigController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('#getConfig', () => {
    it('returns mileageWarningThresholdKm from env', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'MILEAGE_WARNING_THRESHOLD_KM') return 500;
        return undefined;
      });

      const result = controller.getConfig();

      expect(result).toEqual({ mileageWarningThresholdKm: 500 });
    });

    it('falls back to default 500 when MILEAGE_WARNING_THRESHOLD_KM is not set', () => {
      mockConfigService.get.mockReturnValue(undefined);

      const result = controller.getConfig();

      expect(result.mileageWarningThresholdKm).toBe(500);
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend && pnpm exec vitest run src/modules/config/config.controller.spec.ts
```

Expected: FAIL — `ConfigController` not found.

- [ ] **Step 3: Create `ConfigController`**

Create `backend/src/modules/config/config.controller.ts`:

```typescript
import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IAppConfigResDTO } from '@project/types';
import { Public } from '../auth/decorators/public.decorator';

@Controller('config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Public()
  @Get()
  getConfig(): IAppConfigResDTO {
    return {
      mileageWarningThresholdKm:
        this.configService.get<number>('MILEAGE_WARNING_THRESHOLD_KM') ?? 500,
    };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd backend && pnpm exec vitest run src/modules/config/config.controller.spec.ts
```

Expected: PASS — all 4 tests pass.

- [ ] **Step 5: Create `ConfigModule`**

Create `backend/src/modules/config/config.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigController } from './config.controller';

@Module({
  controllers: [ConfigController],
})
export class ConfigModule {}
```

- [ ] **Step 6: Register `ConfigModule` in `AppModule`**

In `backend/src/modules/app/app.module.ts`, add the import statement at the top:

```typescript
import { ConfigModule as AppConfigModule } from '../config/config.module';
```

Add `AppConfigModule` to the `imports` array. The alias avoids a name clash with `@nestjs/config`'s own `ConfigModule`. Do not replace the file — only add the new import.

- [ ] **Step 7: Run all unit tests**

```bash
just test-unit
```

Expected: All tests pass.

- [ ] **Step 8: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [ ] **Step 9: Smoke test**

Start services (`just up-build`) then verify the endpoint is reachable without a token:

```bash
curl -s http://localhost:3001/config
```

Expected: `{"mileageWarningThresholdKm":500}` (or value from your `.env`).

Also verify a protected route still requires auth:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/vehicles
```

Expected: `401`

- [ ] **Step 10: Commit**

```bash
git add backend/src/modules/config/ \
        backend/src/modules/app/app.module.ts
git commit -m "feat: implement public GET /config endpoint"
```

---

## Chunk 4: Frontend Hook

### Task 5: Add `useAppConfig` TanStack Query hook

**Files:**
- Modify: `frontend/src/hooks/queries/keys/key.ts`
- Create: `frontend/src/hooks/queries/config/useAppConfig.ts`

- [ ] **Step 1: Add `CONFIG` to the `QueryGroup` constant**

In `frontend/src/hooks/queries/keys/key.ts`, add `CONFIG: 'config'` to the `QueryGroup` object:

```typescript
export const QueryGroup = Object.freeze({
  HEALTH_CHECK: 'health-check',
  CONFIG: 'config',
} as const);
export type QueryGroup = (typeof QueryGroup)[keyof typeof QueryGroup];
```

- [ ] **Step 2: Create `useAppConfig.ts`**

Create `frontend/src/hooks/queries/config/useAppConfig.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { QueryGroup } from '../keys';
import { apiClient } from '@/lib/api-client';
import { IAppConfigResDTO } from '@project/types';

export const useAppConfig = () => {
  return useQuery<IAppConfigResDTO>({
    queryKey: [QueryGroup.CONFIG],
    queryFn: async () => {
      return await apiClient.get<IAppConfigResDTO>('/config');
    },
    staleTime: Infinity,
  });
};
```

`staleTime: Infinity` — config values are env-controlled and do not change at runtime. The query fetches once per page load and never re-fetches automatically.

- [ ] **Step 3: Build frontend to verify types compile**

```bash
cd frontend && pnpm build
```

Expected: No TypeScript errors.

- [ ] **Step 4: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/queries/keys/key.ts \
        frontend/src/hooks/queries/config/useAppConfig.ts
git commit -m "feat: add useAppConfig hook for fetching app config from backend"
```
