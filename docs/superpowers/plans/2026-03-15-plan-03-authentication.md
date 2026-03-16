# Plan 03: Authentication

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Firebase token verification as a global NestJS guard, auto-create `User` records on first login, and attach the authenticated user to the request context so all subsequent feature modules can use it.

**Architecture:** A `FirebaseAuthGuard` (global) intercepts every request, verifies the `Authorization: Bearer <token>` header via Firebase Admin SDK, then calls `AuthService.resolveUser()` which either fetches the existing `User` or creates a new one. The resolved user is attached to `request.user`. A `CurrentUser` decorator provides clean access in controllers. The `AuthModule` is registered globally in `AppModule`.

**Tech Stack:** NestJS Guards, Firebase Admin SDK (`FirebaseService` from Plan 01), TypeORM (`UserEntity` from Plan 02), `@nestjs/common`

**Spec reference:** `docs/superpowers/specs/2026-03-14-maintenance-tracker-design.md` — Section 2 (Auth flow), Section 4 (Ownership validation)

**Prerequisites:** Plan 01 (FirebaseModule) and Plan 02 (UserEntity) must be complete.

---

## Status: ✅ COMPLETE

**Commits:**
- `26e8f49` — add IAuthUser shared type
- `94dd311` — implement Firebase auth guard with user auto-creation
- `91d7287` — fix auth guard: throw on missing email, add logger, fix token parsing, fix request.user type

**All 10 unit tests passing** (5 test files).

---

## Implementation Diffs vs Plan

### `FirebaseAuthGuard` — deviations from plan

The guard was extended beyond the plan in commit `91d7287`:

1. **Added `Logger`** — `private readonly logger = new Logger(FirebaseAuthGuard.name)` logs token verification failures via `this.logger.warn(...)` instead of silently swallowing the error.

2. **Stricter token parsing** — Plan used `authHeader.split(' ')[1]`. Implementation uses destructuring `const [, token] = authHeader.split(' ')` with an additional null-check: throws `UnauthorizedException` if `token` is falsy (e.g. `"Bearer "` with no trailing value).

3. **Email required** — Plan used `decoded.email ?? ''` (fallback to empty string). Implementation throws `UnauthorizedException('Firebase token must include an email address')` when `decoded.email` is absent. This removes the silent empty-email footgun.

4. **`request.user` typed as `UserEntity`** — Plan typed as `Request & { user: unknown }`. Implementation uses `Request & { user: UserEntity }` for stronger type safety downstream.

### Guard spec — additional test case

One test was added beyond the plan:

```typescript
it('throws UnauthorizedException when token has no email', async () => {
  mockVerifyIdToken.mockResolvedValue({ uid: 'firebase-uid-1' });
  await expect(
    guard.canActivate(makeContext('Bearer valid-token')),
  ).rejects.toThrow(UnauthorizedException);
});
```

This covers the new "email required" behaviour (deviation #3 above).

---

## Chunk 1: Shared Types

### Task 1: Add `IAuthUser` interface to `@project/types`

**Files:**
- Create: `packages/types/src/dtos/auth.dto.ts`
- Modify: `packages/types/src/dtos/index.ts`

The authenticated user shape is shared between the guard and controllers.

- [x] **Step 1: Create `auth.dto.ts`**

Create `packages/types/src/dtos/auth.dto.ts`:

```typescript
export interface IAuthUser {
  id: string;
  email: string;
  firebaseUid: string;
}
```

- [x] **Step 2: Re-export from `packages/types/src/dtos/index.ts`**

Add to `packages/types/src/dtos/index.ts`:

```typescript
export * from './auth.dto';
```

- [x] **Step 3: Build `@project/types`**

```bash
cd packages/types && pnpm run build
```

Expected: `dist/` is updated with no TypeScript errors.

- [x] **Step 4: Commit**

```bash
git add packages/types/src/dtos/auth.dto.ts packages/types/src/dtos/index.ts
git commit -m "feat: add IAuthUser shared type"
```

---

## Chunk 2: AuthModule

### Task 2: Create `UserRepository`

**Files:**
- Create: `backend/src/modules/auth/repositories/user.repository.ts`
- Create: `backend/src/modules/auth/repositories/user.repository.spec.ts`

Wraps TypeORM operations for `UserEntity`. Extends `BaseDBUtil`.

- [x] **Step 1: Write the failing test**

Create `backend/src/modules/auth/repositories/user.repository.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { UserRepository } from './user.repository';
import { UserEntity } from 'src/db/entities/user.entity';

const mockTypeOrmRepo = {
  create: vi.fn(),
  save: vi.fn(),
};

describe('UserRepository', () => {
  let repository: UserRepository;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserRepository,
        { provide: getRepositoryToken(UserEntity), useValue: mockTypeOrmRepo },
      ],
    }).compile();

    repository = module.get<UserRepository>(UserRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('#create', () => {
    it('creates and saves a new user', async () => {
      const newUser = {
        id: 'user-1',
        email: 'test@example.com',
        firebaseUid: 'uid-1',
        createdAt: new Date(),
      } as UserEntity;

      mockTypeOrmRepo.create.mockReturnValue(newUser);
      mockTypeOrmRepo.save.mockResolvedValue(newUser);

      const result = await repository.create({
        creationData: { email: 'test@example.com', firebaseUid: 'uid-1' },
      });

      expect(mockTypeOrmRepo.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        firebaseUid: 'uid-1',
      });
      expect(result).toEqual(newUser);
    });
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

```bash
cd backend && pnpm exec vitest run src/modules/auth/repositories/user.repository.spec.ts
```

Expected: FAIL — `UserRepository` not found.

- [x] **Step 3: Create `user.repository.ts`**

Create `backend/src/modules/auth/repositories/user.repository.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { UserEntity } from 'src/db/entities/user.entity';
import { BaseDBUtil } from 'src/modules/common/base-classes/base-db-util';

export type CreateUserData = {
  email: string;
  firebaseUid: string;
};

@Injectable()
export class UserRepository extends BaseDBUtil<UserEntity, CreateUserData> {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {
    super(UserEntity, userRepo);
  }

  async create(params: {
    creationData: CreateUserData;
    entityManager?: EntityManager;
  }): Promise<UserEntity> {
    const { creationData, entityManager } = params;
    const repo =
      (entityManager?.getRepository(UserEntity) as Repository<UserEntity>) ??
      this.userRepo;

    const user = repo.create({
      email: creationData.email,
      firebaseUid: creationData.firebaseUid,
    });

    return await repo.save(user);
  }
}
```

- [x] **Step 4: Run the test to verify it passes**

```bash
cd backend && pnpm exec vitest run src/modules/auth/repositories/user.repository.spec.ts
```

Expected: PASS

---

### Task 3: Create `AuthService`

**Files:**
- Create: `backend/src/modules/auth/services/auth.service.ts`
- Create: `backend/src/modules/auth/services/auth.service.spec.ts`

`resolveUser` finds or creates the `User` record given Firebase token claims.

- [x] **Step 1: Write the failing test**

Create `backend/src/modules/auth/services/auth.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from './auth.service';
import { UserRepository } from '../repositories/user.repository';

const mockUserRepository = {
  getOne: vi.fn(),
  create: vi.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserRepository, useValue: mockUserRepository },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('#resolveUser', () => {
    it('returns existing user when found by firebaseUid', async () => {
      const existingUser = {
        id: 'user-1',
        email: 'test@example.com',
        firebaseUid: 'firebase-uid-1',
        createdAt: new Date(),
      };
      mockUserRepository.getOne.mockResolvedValue(existingUser);

      const result = await service.resolveUser({
        firebaseUid: 'firebase-uid-1',
        email: 'test@example.com',
      });

      expect(result).toEqual(existingUser);
      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it('creates and returns new user when not found', async () => {
      const newUser = {
        id: 'user-2',
        email: 'new@example.com',
        firebaseUid: 'firebase-uid-2',
        createdAt: new Date(),
      };
      mockUserRepository.getOne.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(newUser);

      const result = await service.resolveUser({
        firebaseUid: 'firebase-uid-2',
        email: 'new@example.com',
      });

      expect(result).toEqual(newUser);
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        creationData: { email: 'new@example.com', firebaseUid: 'firebase-uid-2' },
      });
    });
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

```bash
cd backend && pnpm exec vitest run src/modules/auth/services/auth.service.spec.ts
```

Expected: FAIL — `AuthService` not found.

- [x] **Step 3: Create `AuthService`**

Create `backend/src/modules/auth/services/auth.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { UserEntity } from 'src/db/entities/user.entity';
import { UserRepository } from '../repositories/user.repository';

@Injectable()
export class AuthService {
  constructor(private readonly userRepository: UserRepository) {}

  async resolveUser(params: {
    firebaseUid: string;
    email: string;
  }): Promise<UserEntity> {
    const { firebaseUid, email } = params;

    const existing = await this.userRepository.getOne({
      criteria: { firebaseUid },
    });

    if (existing) return existing;

    return await this.userRepository.create({
      creationData: { email, firebaseUid },
    });
  }
}
```

- [x] **Step 4: Run the test to verify it passes**

```bash
cd backend && pnpm exec vitest run src/modules/auth/services/auth.service.spec.ts
```

Expected: PASS

---

### Task 4: Create `FirebaseAuthGuard` and `CurrentUser` decorator

**Files:**
- Create: `backend/src/modules/auth/guards/firebase-auth.guard.ts`
- Create: `backend/src/modules/auth/guards/firebase-auth.guard.spec.ts`
- Create: `backend/src/modules/auth/decorators/current-user.decorator.ts`

- [x] **Step 1: Write the failing guard test**

Create `backend/src/modules/auth/guards/firebase-auth.guard.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { FirebaseService } from 'src/modules/firebase/firebase.service';
import { AuthService } from '../services/auth.service';

const mockVerifyIdToken = vi.fn();
const mockFirebaseService = {
  app: {
    auth: () => ({ verifyIdToken: mockVerifyIdToken }),
  },
};

const mockAuthService = {
  resolveUser: vi.fn(),
};

function makeContext(authHeader?: string): ExecutionContext {
  const request = {
    headers: { authorization: authHeader },
    user: undefined as unknown,
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('FirebaseAuthGuard', () => {
  let guard: FirebaseAuthGuard;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FirebaseAuthGuard,
        { provide: FirebaseService, useValue: mockFirebaseService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    guard = module.get<FirebaseAuthGuard>(FirebaseAuthGuard);
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

- [x] **Step 2: Run the test to verify it fails**

```bash
cd backend && pnpm exec vitest run src/modules/auth/guards/firebase-auth.guard.spec.ts
```

Expected: FAIL — `FirebaseAuthGuard` not found.

- [x] **Step 3: Create `FirebaseAuthGuard`** _(with deviations — see Implementation Diffs above)_

Create `backend/src/modules/auth/guards/firebase-auth.guard.ts`:

```typescript
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { FirebaseService } from 'src/modules/firebase/firebase.service';
import { AuthService } from '../services/auth.service';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

- [x] **Step 4: Run the test to verify it passes**

```bash
cd backend && pnpm exec vitest run src/modules/auth/guards/firebase-auth.guard.spec.ts
```

Expected: PASS

- [x] **Step 5: Create `CurrentUser` decorator**

Create `backend/src/modules/auth/decorators/current-user.decorator.ts`:

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { IAuthUser } from '@project/types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): IAuthUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user: IAuthUser }>();
    return request.user;
  },
);
```

---

### Task 5: Create `AuthModule` and register globally

**Files:**
- Create: `backend/src/modules/auth/auth.module.ts`
- Modify: `backend/src/modules/app/app.module.ts`

- [x] **Step 1: Create `AuthModule`**

Create `backend/src/modules/auth/auth.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { UserEntity } from 'src/db/entities/user.entity';
import { UserRepository } from './repositories/user.repository';
import { AuthService } from './services/auth.service';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';

// FirebaseModule is @Global() (registered in AppModule via Plan 01),
// so FirebaseService is available here without importing FirebaseModule explicitly.
@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  providers: [
    UserRepository,
    AuthService,
    {
      provide: APP_GUARD,
      useClass: FirebaseAuthGuard,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
```

- [x] **Step 2: Add `AuthModule` to `AppModule` imports**

In `backend/src/modules/app/app.module.ts`, add the import statement:

```typescript
import { AuthModule } from '../auth/auth.module';
```

Add `AuthModule` to the `imports` array. Do not replace the file — only add the new import.

- [x] **Step 3: Run all unit tests**

```bash
just test-unit
```

Expected: All tests pass.

- [x] **Step 4: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [x] **Step 5: Smoke test with a real request**

Start services (`just up-build`) then test the health check without a token — it should now return 401:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/
```

Expected: `401`

**Note:** The health check endpoint is now protected. If you want to verify the guard works end-to-end with a real Firebase token, obtain one from the Firebase Auth emulator or a test project and run:

```bash
curl -H "Authorization: Bearer <your-token>" http://localhost:3001/
```

Expected: `200` with health check response.

- [x] **Step 6: Commit**

```bash
git add backend/src/modules/auth/ backend/src/modules/app/app.module.ts
git commit -m "feat: implement Firebase auth guard with user auto-creation"
```
