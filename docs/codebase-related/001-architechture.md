# Architecture: Maintenance Tracker

**Status:** Living document — reflects design spec and planned implementation.
**Spec:** `docs/superpowers/specs/2026-03-14-maintenance-tracker-design.md`

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
| created_at, updated_at | timestamp | |
| deleted_at | timestamp | soft delete |

### MaintenanceCard
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| vehicle_id | uuid FK | → Vehicle |
| type | enum | `task` / `part` / `item` — display label only |
| name, description | varchar | |
| interval_mileage | decimal nullable | trigger distance (same unit as parent vehicle) |
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
| PATCH | `/vehicles/:id` | Update vehicle (`brand`, `model`, `colour`, `mileage`, `mileage_unit`) |
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
1. Creates a `MaintenanceHistory` record (`done_at_date` = server today).
2. Resets `next_due_mileage` = `done_at_mileage` + `interval_mileage` (if set).
3. Resets `next_due_date` = `done_at_date` + `interval_time_months` (if set).
4. If `done_at_mileage > Vehicle.mileage`, updates `Vehicle.mileage`.
5. Cancels all `pending`/`processing` `BackgroundJob` records for this card.

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
    ├── maintenance-cards/     # MaintenanceCardsModule
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
│   ├── maintenance-cards/  # Maintenance card row and CRUD dialogs
│   ├── pages/              # Page-level components
│   └── providers/          # ReactQueryProvider, etc.
├── hooks/
│   ├── queries/            # TanStack Query read hooks (per feature)
│   └── mutations/          # TanStack Query mutation hooks (per feature)
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
- **Mileage prompt:** On first daily visit to a vehicle dashboard, shows a dismissible prompt to enter odometer reading. Suppression tracked via `localStorage` key `mileage_prompted_{vehicleId}_{YYYY-MM-DD}`.
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
