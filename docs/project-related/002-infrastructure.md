# Infrastructure & Data Layer

## Plans Covered
- Plan 01: Project Infrastructure
- Plan 02: DB Entities & Migrations

---

## Plan 01 — Project Infrastructure

**Goal:** Add Redis to Docker Compose, install BullMQ and Firebase Admin SDK packages, extend `.env.template`, and wire Firebase Admin SDK into a global NestJS module.

### What was implemented

- **Redis** added as a Docker Compose service (`redis:7-alpine`) with healthcheck. `server` service depends on Redis being healthy.
- **Packages installed:** `@nestjs/bullmq`, `bullmq`, `firebase-admin`, `postmark`, `@aws-sdk/client-ses`
- **`FirebaseModule`** (`@Global()`) — initialises Firebase Admin `app` once on startup via env vars; exported for injection across all modules.
- **`FirebaseService`** implements `OnModuleInit`, guards against re-initialisation, and exposes `app` getter.
- **`.env.template`** extended with: `REDIS_PORT`, `REDIS_URL`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `EMAIL_PROVIDER`, `POSTMARK_API_KEY`, `POSTMARK_FROM_ADDRESS`, `AWS_SES_REGION`, `AWS_SES_FROM_ADDRESS`, `MILEAGE_WARNING_THRESHOLD_KM`, `NOTIFICATION_DAYS_BEFORE`, `NOTIFICATION_CRON_SCHEDULE`.

### Key files
- `docker-compose.yml` — Redis service
- `backend/src/modules/firebase/firebase.service.ts`
- `backend/src/modules/firebase/firebase.module.ts`
- `backend/src/modules/app/app.module.ts` — imports `FirebaseModule`

---

## Plan 02 — DB Entities & Migrations

**Goal:** Create all five TypeORM entities, register them, and generate an initial migration.

### What was implemented

Five entities created under `backend/src/db/entities/`:
- `UserEntity` — `users` table
- `VehicleEntity` — `vehicles` table
- `MaintenanceCardEntity` — `maintenance_cards` table
- `MaintenanceHistoryEntity` — `maintenance_histories` table
- `BackgroundJobEntity` — `background_jobs` table

### Key architectural decisions & deviations from original spec

| Decision | Detail |
|---|---|
| **UUIDv7 base entity** | `UuidV7BaseEntity` abstract class generates IDs at application layer via `uuidv7` package + `@BeforeInsert()`. Avoids `uuid-ossp` PostgreSQL extension dependency. IDs are time-sortable. |
| **All timestamps use `timestamptz`** | Prevents timezone bugs when server differs from UTC. |
| **`UserEntity` soft-delete** | Added `updatedAt` and `deletedAt` columns (not in original plan). |
| **`UserEntity.email` is unique** | `@Column({ unique: true })` — prevents silent bugs on email-based lookups. |
| **FK indexes** | `@Index()` on `VehicleEntity.userId`, `MaintenanceCardEntity.vehicleId`, `MaintenanceHistoryEntity.maintenanceCardId`. PostgreSQL does not auto-create FK indexes. |
| **`MaintenanceHistoryEntity` soft-delete** | Added `deletedAt` — history is audit-trail data; hard-delete would destroy records. |
| **`BackgroundJobEntity.expiresAt`** | Renamed from `ttl` — `ttl` conventionally means duration, not timestamp. |
| **`decimalTransformer`** | TypeORM returns `decimal`/`numeric` as strings at runtime. Transformer converts to `number`. Handles `undefined` for optional columns. |

### Key files
- `backend/src/db/entities/base.entity.ts` — `UuidV7BaseEntity`
- `backend/src/db/entities/*.entity.ts` — all five entities
- `backend/src/db/transformers/decimal.transformer.ts`
- `backend/src/db/migrations/1773633630216-init.ts` — initial migration
- `backend/src/db/entity-model.ts` — entity registration
