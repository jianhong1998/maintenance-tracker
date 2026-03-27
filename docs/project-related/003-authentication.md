# Authentication & Public Routes

## Plans Covered
- Plan 03: Authentication (Firebase auth guard, user auto-creation)
- Plan 07: Config Endpoint (public routes, `@Public()` decorator)

---

## Plan 03 — Authentication

**Goal:** Firebase token verification as a global NestJS guard, auto-create `User` records on first login, attach authenticated user to request context.

### What was implemented

- **`IAuthUser`** shared type in `@project/types` (`id`, `email`, `firebaseUid`)
- **`UserRepository`** — extends `BaseDBUtil`, wraps TypeORM operations for `UserEntity`
- **`AuthService.resolveUser()`** — finds existing user by `firebaseUid` or creates one
- **`FirebaseAuthGuard`** (`APP_GUARD`) — global guard that verifies `Authorization: Bearer <token>`, calls `resolveUser`, attaches `UserEntity` to `request.user`
- **`CurrentUser` decorator** — clean param decorator for controller methods
- **`AuthModule`** — registered globally in `AppModule`

### Key deviations from original plan

| Deviation | Detail |
|---|---|
| **Logger added** | Guard logs token verification failures via `this.logger.warn()` |
| **Stricter token parsing** | Throws if token part after "Bearer " is falsy |
| **Email required** | Throws `UnauthorizedException` if decoded Firebase token has no email (original plan fell back to empty string) |
| **`request.user` typed as `UserEntity`** | Stronger type safety downstream |

### Key files
- `packages/types/src/dtos/auth.dto.ts` — `IAuthUser`
- `backend/src/modules/auth/guards/firebase-auth.guard.ts`
- `backend/src/modules/auth/services/auth.service.ts`
- `backend/src/modules/auth/repositories/user.repository.ts`
- `backend/src/modules/auth/decorators/current-user.decorator.ts`
- `backend/src/modules/auth/auth.module.ts`

---

## Plan 07 — Config Endpoint & Public Routes

**Goal:** Public `GET /config` endpoint exposing env-controlled thresholds; `@Public()` decorator to bypass auth guard; frontend `useAppConfig` hook.

### What was implemented

**Backend:**
- **`@Public()` decorator** — `SetMetadata(IS_PUBLIC_KEY, true)` on routes/controllers
- **`FirebaseAuthGuard` updated** — uses `Reflector.getAllAndOverride(IS_PUBLIC_KEY)` to skip auth for public routes. Also removed the pre-existing API test mode bypass (`BACKEND_ENABLE_API_TEST_MODE`)
- **`ConfigController`** — `@Public() GET /config` reads `MILEAGE_WARNING_THRESHOLD_KM` from `ConfigService`, falls back to `500`
- **`IAppConfigResDTO`** — `{ mileageWarningThresholdKm: number }` in `@project/types`
- **`ConfigModule`** — registered in `AppModule` (aliased as `AppConfigModule` to avoid clash with `@nestjs/config`'s `ConfigModule`)

**Frontend:**
- **`useAppConfig`** — TanStack Query hook with `staleTime: Infinity` (config is env-controlled, doesn't change at runtime). Uses flat `queryKey: [QueryGroup.CONFIG]` (not list/one semantics).

### Key files
- `backend/src/modules/auth/decorators/public.decorator.ts`
- `backend/src/modules/auth/guards/firebase-auth.guard.ts` — updated with Reflector
- `backend/src/modules/config/config.controller.ts`
- `backend/src/modules/config/config.module.ts`
- `packages/types/src/dtos/config.dto.ts`
- `frontend/src/hooks/queries/config/useAppConfig.ts`
