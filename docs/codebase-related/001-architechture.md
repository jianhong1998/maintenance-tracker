# Architecture: Maintenance Tracker

**Status:** Living document — reflects design spec and planned implementation.

---

## 1. Repository Layout

TurboRepo monorepo with pnpm workspaces. Build order is enforced by TurboRepo: `packages/types` must build before `backend` or `frontend`.

```
maintenance-tracker/
├── packages/types/        # Shared TypeScript types and DTOs (@project/types)
├── backend/               # NestJS — HTTP server + worker (same codebase, two entry points)
├── frontend/              # Next.js 15 App Router
├── api-test/              # Vitest integration tests (hit running backend)
├── docker/                # Dockerfiles
├── docker-compose.yml     # Local dev services
├── Justfile               # Top-level task runner (delegates to turbo/pnpm)
└── .env / .env.template   # Environment variables (single root .env)
```

---

## 2. System Components

| Component | Technology | Port | Notes |
|---|---|---|---|
| Frontend | Next.js 15 (App Router) | 3000 | Firebase Auth SDK, TanStack Query |
| Backend HTTP | NestJS | 3001 | REST API, Firebase token verification |
| Backend Worker | NestJS (same image) | — | Separate entry point `main-worker.ts`, no HTTP |
| Database | PostgreSQL + TypeORM | 5432 | Source of truth |
| Queue Broker | Redis + BullMQ | 6379 | Job delivery, not source of truth |
| Email | Postmark (dev) / AWS SES (prod) | — | Switched via `EMAIL_PROVIDER` env var |

Both backend entry points run as separate Docker Compose services using the **same built image** with different start commands.

---

## 3. Authentication Flow

1. Frontend obtains a Firebase ID token via Google Sign-In (Firebase Auth SDK).
2. Every API request includes `Authorization: Bearer <firebase_id_token>`.
3. NestJS `AuthGuard` verifies the token with Firebase Admin SDK.
4. On first login, the guard resolves or creates a `User` record keyed by `firebase_uid`.

The `FirebaseModule` is declared `@Global()` in NestJS — the Admin SDK is initialised once and available everywhere without re-importing the module.

---

## 4. Data Model

### Entities and Relationships

```
User (1) ──< Vehicle (1) ──< MaintenanceCard (1) ──< MaintenanceHistory
                                     │
                                     └──< BackgroundJob (via reference_id)
```

### User
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| email | varchar | |
| firebase_uid | varchar unique | |
| created_at | timestamp | |

### Vehicle
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | → User |
| brand, model, colour | varchar | |
| mileage | decimal | current odometer, in vehicle's own unit |
| mileage_unit | enum | `km` or `mile` — per vehicle |
| registration_number | varchar(15) nullable | optional vehicle plate number; null = not set |
| mileage_last_updated_at | timestamptz nullable | set by `recordMileage`; used to suppress daily mileage prompt |
| created_at, updated_at | timestamp | |
| deleted_at | timestamp | soft delete |

### MaintenanceCard
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| vehicle_id | uuid FK | → Vehicle |
| type | enum | `task` / `part` / `item` — display label only |
| name, description | varchar | |
| interval_mileage | int nullable | trigger distance (same unit as parent vehicle) |
| interval_time_months | integer nullable | trigger time in months |
| next_due_mileage | decimal nullable | recomputed on mark-done; stored for fast queries |
| next_due_date | date nullable | recomputed on mark-done; stored for fast queries |
| created_at, updated_at | timestamp | |
| deleted_at | timestamp | soft delete |

At least one of `interval_mileage` or `interval_time_months` must be set (API validation). `next_due_*` fields are system-managed — not directly patchable.

### MaintenanceHistory
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| maintenance_card_id | uuid FK | → MaintenanceCard |
| done_at_mileage | decimal nullable | null when card has no `interval_mileage` |
| done_at_date | date | always server-side today |
| notes | text nullable | |
| created_at | timestamp | |

History is retained even when the parent card is soft-deleted.

### BackgroundJob
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| job_type | varchar | e.g. `notification.upcoming`, `notification.overdue` |
| reference_id | uuid nullable | related entity ID (e.g. `MaintenanceCard.id`) |
| reference_type | varchar nullable | e.g. `maintenance_card` |
| idempotency_key | varchar unique | prevents duplicate job creation |
| payload | jsonb | full job data |
| status | enum | `pending` / `processing` / `done` / `failed` / `cancelled` |
| scheduled_from | timestamp | do not pick up before this time |
| ttl | timestamp | scheduler skips stale jobs (marks `done`) |
| last_attempted_at | timestamp nullable | |
| created_at, updated_at | timestamp | |

**Idempotency keys:**
- `notification.upcoming:{cardId}:{next_due_date}`
- `notification.overdue:{cardId}:{next_due_date}`

---

## 5. API Design

All endpoints require `Authorization: Bearer <firebase_id_token>`. Ownership violations return `404` (not `403`) to avoid leaking resource existence.

### Vehicles
| Method | Path | Description |
|---|---|---|
| GET | `/vehicles` | List authenticated user's vehicles |
| POST | `/vehicles` | Create a vehicle |
| GET | `/vehicles/:id` | Get vehicle detail |
| PATCH | `/vehicles/:id` | Update vehicle (`brand`, `model`, `colour`, `mileage`, `mileage_unit`, `registrationNumber`) |
| PATCH | `/vehicles/:id/mileage` | Record a mileage reading — updates `mileage` and sets `mileageLastUpdatedAt` |
| DELETE | `/vehicles/:id` | Soft delete — cascades to cards and cancels their background jobs |

### Maintenance Cards
| Method | Path | Description |
|---|---|---|
| GET | `/vehicles/:id/maintenance-cards` | List cards. Query param: `sort=urgency\|name` |
| POST | `/vehicles/:id/maintenance-cards` | Create a card |
| GET | `/vehicles/:id/maintenance-cards/:cardId` | Get a single card |
| PATCH | `/vehicles/:id/maintenance-cards/:cardId` | Update (`type`, `name`, `description`, `interval_mileage`, `interval_time_months`) |
| DELETE | `/vehicles/:id/maintenance-cards/:cardId` | Soft delete — cancels background jobs |
| POST | `/vehicles/:id/maintenance-cards/:cardId/complete` | Mark maintenance done |
| GET | `/vehicles/:id/maintenance-cards/:cardId/history` | List completion history |

### Config
| Method | Path | Response |
|---|---|---|
| GET | `/config` | `{ mileage_warning_threshold_km: number }` |

### Mark Done Logic
On `POST .../complete`:
1. Validates `done_at_mileage` is present when card has `interval_mileage`; returns 400 if missing.
2. Validates `done_at_mileage >= Vehicle.mileage` when provided; returns 400 if below current mileage.
3. Resets `next_due_mileage` = `done_at_mileage` + `interval_mileage` (if set).
4. Resets `next_due_date` = `done_at_date` + `interval_time_months` (if set).
5. Creates a `MaintenanceHistory` record (`done_at_date` = server today) and saves the updated card — both inside a single transaction.
6. If `done_at_mileage > Vehicle.mileage`, updates `Vehicle.mileage` (after transaction commit).
7. Cancels all `pending`/`processing` `BackgroundJob` records for this card (inside the transaction).

---

## 6. Backend Module Structure

```
backend/src/
├── main.ts                    # HTTP server entry point
├── main-worker.ts             # Worker entry point (no controllers, no HTTP)
├── configs/
│   └── app.config.ts          # AppConfig bootstrapping
├── db/
│   ├── database.config.ts     # TypeORM config
│   └── entity-model.ts        # Entity registry
└── modules/
    ├── app/                   # Root AppModule, health check
    ├── common/                # Shared utilities, base classes
    ├── firebase/              # FirebaseModule (@Global) — Admin SDK init
    ├── auth/                  # AuthGuard — token verification, user resolution
    ├── vehicles/              # VehiclesModule
    ├── maintenance-cards/     # MaintenanceCardsModule — imports VehicleModule for ownership checks; VehicleModule does NOT import MaintenanceCardsModule (one-way dependency). Vehicle→card delete cascade is handled at the ORM layer via TypeORM @OneToMany({ cascade: ['soft-remove'] }) on VehicleEntity.
    ├── maintenance-history/   # MaintenanceHistoryModule
    ├── config/                # ConfigModule — GET /config endpoint
    ├── background-jobs/       # BackgroundJobModule — DB-backed job table
    ├── scheduler/             # Cron scheduler — scans cards, inserts jobs
    ├── worker/                # BullMQ worker — processes jobs
    └── email/                 # EmailModule — Postmark/SES abstraction
```

Feature code convention: each module gets its own folder with `controller`, `service`, and `*.spec.ts` files.

---

## 7. Worker & Notification System

### Entry Points
- `main.ts` — HTTP server with all feature controllers.
- `main-worker.ts` — Worker process only; imports worker/scheduler/email modules, no HTTP controllers.

### Scheduler (cron, interval via `NOTIFICATION_CRON_SCHEDULE`)
1. Scans `MaintenanceCard` records for upcoming and overdue conditions.
2. Inserts `BackgroundJob` rows with `INSERT ... ON CONFLICT DO NOTHING` (idempotency key prevents duplicates).
3. Enqueues a lightweight BullMQ message containing only the `BackgroundJob.id`.
4. Re-enqueues any `pending`/`processing` jobs with `scheduled_from <= now` and `ttl > now` (recovery).

### Worker (always-running BullMQ consumer)
1. Picks up BullMQ message.
2. Fetches `BackgroundJob` record from DB by `id`.
3. If `ttl < now` → marks `done`, skips execution (stale fast-path).
4. Marks `processing`.
5. Executes handler by `job_type`.
6. Marks `done` or `failed`.

### Job Types
| Job Type | Behaviour |
|---|---|
| `notification.upcoming` | One "due soon" email per card per due date. Sent when `next_due_date` enters the lead-time window. |
| `notification.overdue` | One "overdue" email per card per due date. Idempotency key prevents duplicates across restarts. |

**Mileage-based notifications are out of scope for MVP.** Only `next_due_date` triggers email.

### Email Provider Selection
Resolved from `EMAIL_PROVIDER` env var:
- `postmark` — Postmark SDK, sandbox mode for dev (no real sends).
- `ses` — AWS SES for staging/prod.

---

## 8. Frontend Structure

```
frontend/src/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx
│   ├── page.tsx            # → / (home)
│   ├── login/              # /login
│   └── vehicles/[id]/      # /vehicles/:id (dashboard)
├── components/
│   ├── ui/                 # shadcn/ui style primitives (Dialog, Button, …)
│   ├── maintenance-cards/  # Maintenance card row and CRUD dialogs (MaintenanceCardFormDialog, MarkDoneDialog, DeleteConfirmDialog)
│   ├── pages/              # Page-level components
│   └── providers/          # ReactQueryProvider, etc.
├── hooks/
│   ├── queries/            # TanStack Query read hooks (per feature)
│   └── mutations/          # TanStack Query mutation hooks (per feature); maintenance-cards subfolder contains four hooks: useCreateMaintenanceCard, useUpdateMaintenanceCard, useDeleteMaintenanceCard, useMarkDone
├── lib/
│   ├── api-client.ts       # Centralised API calls
│   ├── query-client.ts     # TanStack Query client config
│   └── utils.ts
├── constants/
└── types/
```

### Pages
| Route | Description |
|---|---|
| `/login` | Google Sign-In (Firebase Auth) |
| `/` | Home — vehicle grid, warning count summary |
| `/vehicles/:id` | Vehicle dashboard — maintenance cards list |

### Key Frontend Behaviours
- **Mileage warning:** Remaining mileage converted to km, compared against `MILEAGE_WARNING_THRESHOLD_KM` from `GET /config`. Cards turn yellow/orange at threshold, red when overdue.
- **Mileage prompt:** On first daily visit to a vehicle dashboard, shows a dismissible prompt to enter odometer reading. Suppression uses a hybrid strategy: DB field `mileageLastUpdatedAt` suppresses when the user has already recorded mileage today (any device); `localStorage` key `dismissMileagePromptDate_{vehicleId}` suppresses for the rest of the day on the current device when the user dismisses without submitting.
- **Vehicle display labels:** `frontend/src/lib/vehicle-display.ts` exports `getVehicleDisplayLabels(vehicle)` which returns `{ primary, secondary }`. When `registrationNumber` is set, `primary` = registration number and `secondary` = `{brand} {model}`; otherwise `primary` = `{brand} {model}` and `secondary` = null. Used by `VehicleCard` and `VehicleDashboardPage`.
- **Sort:** Toggle between `urgency` (overdue first, then by closeness to due) and `name` (alphabetical).

### Card Colour Logic
| State | Colour |
|---|---|
| Any dimension overdue | Red |
| Mileage within warning threshold (not overdue) | Yellow/Orange |
| All clear | Green |
| No `interval_mileage` (time-only card) | Red or Green only — no yellow state |

---

## 9. Soft Delete Cascade

| Action | Cascade |
|---|---|
| Delete `Vehicle` | Soft-deletes all its `MaintenanceCard` records. Cancels their `pending`/`processing` `BackgroundJob` records. |
| Delete `MaintenanceCard` | Cancels its `pending`/`processing` `BackgroundJob` records. `MaintenanceHistory` is retained. |
| History endpoint on deleted card | Uses `withDeleted: true` on card query. Vehicle ownership check still applies (404 if vehicle deleted). |

---

## 10. Environment Variables

| Variable | Used By | Description |
|---|---|---|
| `DATABASE_HOST/PORT/USER/PASSWORD/DB` | Backend | PostgreSQL connection |
| `REDIS_URL` | Backend/Worker | BullMQ Redis connection |
| `REDIS_PORT` | Docker | Exposed Redis port |
| `FIREBASE_PROJECT_ID` | Backend | Firebase Admin SDK |
| `FIREBASE_CLIENT_EMAIL` | Backend | Firebase Admin SDK |
| `FIREBASE_PRIVATE_KEY` | Backend | Firebase Admin SDK |
| `EMAIL_PROVIDER` | Worker | `postmark` or `ses` |
| `POSTMARK_API_KEY` | Worker | Postmark credentials |
| `POSTMARK_FROM_ADDRESS` | Worker | Sender address |
| `AWS_SES_REGION` | Worker | SES region |
| `AWS_SES_FROM_ADDRESS` | Worker | Sender address |
| `MILEAGE_WARNING_THRESHOLD_KM` | Backend/Frontend | Warning threshold (km) |
| `NOTIFICATION_DAYS_BEFORE` | Worker | Lead days for upcoming email |
| `NOTIFICATION_CRON_SCHEDULE` | Worker | Cron expression for scheduler |

---

## 11. Local Development

```bash
just up-build        # Build images and start all services
just test-unit       # Run backend unit tests (Vitest + SWC)
just test-api        # Run API integration tests (requires running services)
just format          # Format all workspaces
just lint            # Lint all workspaces
just db-data-up      # Seed database
just db-data-reset   # Reset and reseed
```

Migration workflow:
```bash
cd backend && pnpm run migration:generate --name=MigrationName
cd backend && pnpm run migration:run
```

---

## 12. Architectural Patterns & Decisions

#### Backend: ORM-level cascade over service-layer cascade

Delete cascade for Vehicle → MaintenanceCard is implemented via TypeORM `@OneToMany({ cascade: ['soft-remove'] })` on `VehicleEntity`, not by calling `MaintenanceCardService` from `VehicleService`. This eliminates a circular module dependency (both modules needed each other) and keeps module dependency one-directional: `MaintenanceCardModule` → `VehicleModule`.

**Rule:** When two modules would need to import each other, resolve the dependency by pushing shared behaviour into the data layer (ORM relations, cascade) rather than using `forwardRef`.

#### Frontend: Firebase config loaded at runtime via Server Action

Firebase config (`apiKey`, `authDomain`, `projectId`) is never embedded in the client bundle. A Next.js Server Action (`getFirebaseConfig()`) reads `process.env` at request time, then the client calls `initFirebase(config)` to lazily initialize Firebase.

**Why:** `next build` runs during Docker image build before env vars are injected; compile-time substitution bakes undefined values into the bundle.

**Pattern:** `firebase.ts` exposes a lazy init API (`initFirebase(config)` + `getFirebaseAuth()`). `AuthProvider` calls the server action on mount, then initializes Firebase. `getFirebaseAuth()` throws if called before init.

#### Frontend: State lifting for dialog/dropdown mutual exclusion

All dialog and dropdown open/close state for the vehicle dashboard lives in `VehicleDashboardPage` (not in individual card rows or dialogs). This makes mutual exclusion a free side-effect: only one piece of state can be set at a time.

**Rule:** When multiple UI elements must be mutually exclusive, lift their state to a common ancestor rather than adding explicit locking/coordination logic between siblings.

#### Frontend: TanStack Query cache invalidation strategy

- **Prefix match** (no `exact: true`): used for list invalidation after create/patch/delete — covers both sorted and unsorted cache entries for the same vehicle.
- **Exact match** (`exact: true`): used for individual entity invalidation to avoid over-invalidating the list.
- `useMarkDone` invalidates both `[MAINTENANCE_CARDS, vehicleId]` and `[VEHICLES, vehicleId]` (exact) because mark-done may update vehicle mileage.

#### Backend: separate endpoint for system-managed field updates

`mileageLastUpdatedAt` is a system field set exclusively by recorded mileage events. A dedicated `PATCH /vehicles/:id/mileage` endpoint (`VehicleService.recordMileage`) owns this field rather than letting the general `PATCH /vehicles/:id` touch it. This prevents the field from being silently overwritten by unrelated vehicle edits and makes the recording intent explicit.

**Rule:** When a field has a specific update semantic (e.g. it must be set by a particular user action, not general editing), give it its own endpoint rather than folding it into a general-purpose update.

#### Frontend: centralised display label helper over inline conditionals

`getVehicleDisplayLabels(vehicle)` in `frontend/src/lib/vehicle-display.ts` encapsulates the `registrationNumber`-or-fallback logic in one place. All UI surfaces (card, dashboard header) call this helper rather than duplicating the `?? \`${brand} ${model}\`` conditional.

**Rule:** When the same conditional display logic is needed in two or more components, extract it into a pure helper rather than repeating the branch at each call site.
