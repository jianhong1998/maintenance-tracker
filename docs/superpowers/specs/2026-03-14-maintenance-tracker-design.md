# Maintenance Tracker — Design Spec

**Date:** 2026-03-14
**Status:** Approved

---

## 1. Problem Statement

Vehicle owners need to track maintenance schedules across multiple vehicles. Without a proper tool, they cannot easily tell how many kilometres remain before a maintenance task is due. The current workaround (notebooks) makes it hard to compute remaining mileage dynamically.

---

## 2. System Overview

A web application for vehicle maintenance tracking. Single monorepo (TurboRepo + pnpm) with two backend entry points sharing the same NestJS codebase.

**Components:**

| Component | Technology | Notes |
|---|---|---|
| Frontend | Next.js 15 (App Router) | Firebase Auth SDK for Google Login |
| Backend HTTP Server | NestJS on port 3001 | Verifies Firebase ID tokens, REST API |
| Backend Worker | NestJS (same codebase) | Separate entry point `main-worker.ts`, processes BullMQ jobs |
| Database | PostgreSQL + TypeORM | Primary data store and source of truth |
| Queue Broker | Redis + BullMQ | Triggers job execution; DB is source of truth |
| Email | Postmark (local/dev) or AWS SES (staging/prod) | Switched via `EMAIL_PROVIDER` env var |

**Auth flow:** Frontend obtains Firebase ID token → sends as `Authorization: Bearer <token>` → NestJS Guard verifies with Firebase Admin SDK → resolves or creates `User` record on first login.

---

## 3. Data Model

### User
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| email | varchar | |
| firebase_uid | varchar | unique |
| created_at | timestamp | |

### Vehicle
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → User |
| brand | varchar | |
| model | varchar | |
| colour | varchar | |
| mileage | decimal | current odometer reading, in the vehicle's own unit |
| mileage_unit | enum | `km` or `mile` |
| created_at | timestamp | |
| updated_at | timestamp | |
| deleted_at | timestamp | soft delete |

- No limit on vehicles per user.
- Mileage unit is per-vehicle (different vehicles may use different units).

### MaintenanceCard
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| vehicle_id | uuid | FK → Vehicle |
| type | enum | `task`, `part`, `item` — display label only, no business logic impact |
| name | varchar | |
| description | varchar | nullable |
| interval_mileage | decimal | nullable — distance interval, stored in same unit as parent vehicle |
| interval_time_months | integer | nullable — time interval in months |
| next_due_mileage | decimal | nullable — recomputed on mark-done, in same unit as parent vehicle |
| next_due_date | date | nullable — recomputed on mark-done |
| created_at | timestamp | |
| updated_at | timestamp | |
| deleted_at | timestamp | soft delete |

- `last_done_*` fields are omitted — derive from `MaintenanceHistory` if needed.
- `next_due_*` are stored for fast dashboard queries without scanning history.
- To resolve the vehicle's mileage unit for history display, join: `MaintenanceHistory → MaintenanceCard → Vehicle`.
- At least one of `interval_mileage` or `interval_time_months` must be set (validated at API layer).
- When either `interval_mileage` or `interval_time_months` is updated via `PATCH`, all `pending`/`processing` `BackgroundJob` records for that card are set to `cancelled`. The scheduler will re-create jobs on its next run based on the updated values.

### MaintenanceHistory
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| maintenance_card_id | uuid | FK → MaintenanceCard |
| done_at_mileage | decimal | nullable — vehicle mileage at time of completion, in same unit as parent vehicle; null when card has no `interval_mileage` |
| done_at_date | date | date of completion — always set to server-side today (not user-supplied) |
| notes | text | optional, no length cap |
| created_at | timestamp | |

### BackgroundJob
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| job_type | varchar | e.g. `notification.upcoming`, `notification.overdue` |
| reference_id | uuid | nullable — ID of the related entity (e.g. `MaintenanceCard.id`) |
| reference_type | varchar | nullable — entity type (e.g. `maintenance_card`) |
| idempotency_key | varchar | unique — prevents duplicate job creation (e.g. `notification.overdue:{cardId}:{next_due_date}`) |
| payload | jsonb | full job data |
| status | enum | `pending`, `processing`, `done`, `failed`, `cancelled` |
| scheduled_from | timestamp | do not pick up before this time (supports delayed jobs) |
| ttl | timestamp | scheduler skips and marks `done` any job where `ttl < now` (job is stale). TTL values: `notification.upcoming` → `next_due_date` (stale once card becomes overdue — the overdue job takes over); `notification.overdue` → `next_due_date + 30 days` (grace window to attempt delivery). |
| last_attempted_at | timestamp | nullable |
| created_at | timestamp | |
| updated_at | timestamp | |

**`scheduled_from`:** Set to `now()` at job creation time — jobs are eligible for pickup immediately unless a future delay is explicitly needed (not applicable to notification jobs in MVP).

**Deduplication:** The scheduler uses `idempotency_key` with a unique DB constraint to prevent creating duplicate jobs. `INSERT ... ON CONFLICT DO NOTHING` is the creation pattern. The `idempotency_key` is computed from values at job creation time — specifically the `next_due_date` value on the `MaintenanceCard` at the moment the scheduler runs, not the current value at send time.

**Overdue idempotency:** For `notification.overdue`, the idempotency key is `notification.overdue:{cardId}:{next_due_date}`. This prevents duplicate overdue emails even if the worker crashes mid-send and the job is re-enqueued. The correct execution sequence is: mark `processing` → send email → mark `done` or `failed`. The idempotency key on the DB row prevents duplicate job creation; it does not guarantee exactly-once delivery. Send failures are marked `failed` and are not retried automatically for the overdue type.

**Cancellation:** When a `Vehicle` or `MaintenanceCard` is soft-deleted, related `pending`/`processing` `BackgroundJob` records are set to `cancelled` (not `done`). This distinguishes "was cancelled" from "ran successfully".

---

## 4. API Design

All endpoints require `Authorization: Bearer <firebase_id_token>`.

**Ownership validation:** All vehicle-scoped, card-scoped, and history endpoints must verify that the requested `vehicle_id` belongs to the authenticated user. If not, return `404` (not `403`) to avoid leaking existence of other users' resources. The same applies to maintenance card and history operations — the card's parent vehicle must belong to the authenticated user.

### Vehicles
| Method | Path | Description |
|---|---|---|
| GET | `/vehicles` | List authenticated user's vehicles |
| POST | `/vehicles` | Create a vehicle |
| GET | `/vehicles/:id` | Get vehicle detail |
| PATCH | `/vehicles/:id` | Update vehicle info (including mileage) |
| DELETE | `/vehicles/:id` | Soft delete vehicle — cascades soft delete to all its `MaintenanceCard` records and cancels their pending `BackgroundJob` records |

### Maintenance Cards
| Method | Path | Description |
|---|---|---|
| GET | `/vehicles/:id/maintenance-cards` | List cards for a vehicle. Query param: `sort=urgency\|name` |
| POST | `/vehicles/:id/maintenance-cards` | Create a maintenance card |
| GET | `/vehicles/:id/maintenance-cards/:cardId` | Get a single card |
| PATCH | `/vehicles/:id/maintenance-cards/:cardId` | Update a card — see patchable fields below |
| DELETE | `/vehicles/:id/maintenance-cards/:cardId` | Soft delete a card — cancels its pending `BackgroundJob` records |

**Patchable fields for `PATCH /vehicles/:id/maintenance-cards/:cardId`:** `type`, `name`, `description`, `interval_mileage`, `interval_time_months`. Fields `next_due_mileage` and `next_due_date` are system-managed (derived from mark-done) and are **not** directly patchable.

**Patchable fields for `PATCH /vehicles/:id`:** `brand`, `model`, `colour`, `mileage`, `mileage_unit`.

### Mark Done
| Method | Path | Description |
|---|---|---|
| POST | `/vehicles/:id/maintenance-cards/:cardId/complete` | Mark maintenance done |

Request body:
```json
{
  "done_at_mileage": 12500,
  "notes": "optional note"
}
```

- `done_at_mileage` — optional when the card has no `interval_mileage`; required when `interval_mileage` is set (including cards with both `interval_mileage` and `interval_time_months`). Must be a positive number greater than zero.
- `done_at_date` is always set to the server-side current date (not client-supplied).

On completion:
- Creates a `MaintenanceHistory` record (`done_at_date` = server today).
- Resets `next_due_mileage` = `done_at_mileage` + `interval_mileage` (if `interval_mileage` set).
- Resets `next_due_date` = `done_at_date` + `interval_time_months` (if `interval_time_months` set).
- If `done_at_mileage` is provided and `done_at_mileage > Vehicle.mileage`, updates `Vehicle.mileage` to `done_at_mileage`.
- Sets all `pending`/`processing` `BackgroundJob` records for this card to `cancelled` — this includes both `notification.upcoming` and `notification.overdue` job types.

### Maintenance History
| Method | Path | Description |
|---|---|---|
| GET | `/vehicles/:id/maintenance-cards/:cardId/history` | List completion history for a card |

### Config
| Method | Path | Description |
|---|---|---|
| GET | `/config` | Returns app-wide config for frontend use. Response: `{ mileage_warning_threshold_km: number }`. This is the exhaustive list of fields — backend-only vars (e.g. `NOTIFICATION_CRON_SCHEDULE`) are not exposed. |

---

## 5. Worker & Notification Logic

### Entry Points
- `backend/src/main.ts` — HTTP server (NestJS + controllers)
- `backend/src/main-worker.ts` — Worker process (no HTTP, no controllers; registers only worker modules)

Both run as separate Docker Compose services using the same image with different start commands.

### Scheduler (runs on cron schedule via `NOTIFICATION_CRON_SCHEDULE` env var)
1. Scans `MaintenanceCard` records to determine which notifications are needed:
   - `next_due_date >= today AND next_due_date - today <= NOTIFICATION_DAYS_BEFORE` → attempt `INSERT ... ON CONFLICT DO NOTHING` for a `notification.upcoming` job with idempotency key `notification.upcoming:{cardId}:{next_due_date}` (single reminder per due date, not daily; already-overdue cards are excluded)
   - `next_due_date < today` → attempt `INSERT ... ON CONFLICT DO NOTHING` for a `notification.overdue` job with idempotency key `notification.overdue:{cardId}:{next_due_date}`
2. For each newly inserted `BackgroundJob`, enqueues a lightweight BullMQ message containing only the `BackgroundJob.id`.
3. Re-enqueues any `BackgroundJob` in `pending` or `processing` status where `scheduled_from <= now` and `ttl > now` (recovery from Redis/worker restart).

**Duplicate BullMQ message handling:** BullMQ must be configured with `removeOnComplete: true` and `removeOnFail: true`. If the worker picks up a message and finds the `BackgroundJob` already in `processing` state (duplicate enqueue), it skips execution and discards the message silently.

**Note:** Mileage-based notification emails are out of scope for MVP. The mileage warning (`MILEAGE_WARNING_THRESHOLD_KM`) is a frontend-only visual indicator. Only time-based (`next_due_date`) triggers produce email notifications.

### Worker (always-running, listening to BullMQ)
1. Picks up BullMQ message.
2. Fetches full `BackgroundJob` record from DB by `id`.
3. If `ttl < now` → marks job `done` directly (stale fast-path: skips `processing` state, no handler executed).
4. Marks job `processing`.
5. Executes handler based on `job_type`.
6. Marks job `done` or `failed`.

### Email Job Types
| Job Type | Behaviour |
|---|---|
| `notification.upcoming` | Sends a single "maintenance due soon" email when `next_due_date` first enters the lead-time window. One email per card per due date. |
| `notification.overdue` | Sends one-time "maintenance overdue" email. Idempotency key prevents duplicates across restarts. |

### Email Provider
Resolved from `EMAIL_PROVIDER` env var:
- `postmark` — Postmark SDK, sandbox mode for local/dev (no real emails sent)
- `ses` — AWS SES for staging/prod

### Mileage Warning (Frontend Only)
- Backend exposes `MILEAGE_WARNING_THRESHOLD_KM` via `GET /config`.
- Frontend computes remaining mileage in the vehicle's native unit, then converts to km for threshold comparison.
- Conversion: `1 mile = 1.60934 km`
- If `remaining_km <= mileage_warning_threshold_km` → card renders in warning colour (yellow/orange).
- If overdue (`remaining < 0`) → card renders in red.
- Cards with no `interval_mileage` (time-only) skip the mileage threshold check — no mileage-based warning colour is shown for these cards.

---

## 6. Frontend Structure

### Pages
| Route | Description |
|---|---|
| `/login` | Google Sign-in button (Firebase Auth) |
| `/` | Home — vehicle cards grid with status summary. Warning count = number of non-deleted cards (on non-deleted vehicles) that are mileage-warning (within threshold) OR overdue (date or mileage). Shows "all good" when count is 0. |
| `/vehicles/:id` | Vehicle maintenance dashboard — list of maintenance cards |

### Mileage Update Prompt
- On first visit to a vehicle's dashboard on a given day, show a **soft prompt** (dismissible) asking the user to enter the current odometer reading. Submitting calls `PATCH /vehicles/:id` with `{ mileage: <value> }`.
- "First visit on a given day" is tracked via `localStorage` using the key `mileage_prompted_{vehicleId}_{YYYY-MM-DD}`. If the key exists, skip the prompt.
- User can dismiss if not beside the vehicle. Dismissal also sets the localStorage key to suppress re-showing that day.

### Maintenance Card UI (Compact Row style)
- Left: name + type badge (cosmetic label: task / part / item)
- Right: remaining mileage (or "OVERDUE") in the vehicle's native unit
- Row background colour is determined by the **most urgent** dimension:
  - 🔴 Red — any dimension is overdue (`next_due_date < today` OR `next_due_mileage < current_vehicle_mileage`)
  - 🟡 Yellow/Orange — no dimension overdue, but mileage remaining is within `mileage_warning_threshold_km` (mileage dimension only; no equivalent time-based visual warning in MVP)
  - 🟢 Green — all clear
  - Cards with no `interval_mileage` can only show 🔴 (date overdue) or 🟢 (all clear) — no yellow state.

### Sort Options (on vehicle dashboard)
- Toggle between **Urgency** (closest to due first, overdue at top) and **Name** (alphabetical A–Z).
- **Urgency sort rules:**
  - Overdue cards rank first. Within the overdue group:
    - Cards overdue on the date dimension (or both) sort by `next_due_date` ascending (earliest = most overdue).
    - Cards overdue only on the mileage dimension sort after all date-overdue cards, ordered by `next_due_mileage` ascending (lowest = most overdue).
  - For non-overdue cards with both `next_due_date` and `next_due_mileage`: use `next_due_date` ascending as the primary sort key.
  - For cards with only `next_due_date`: sort by days remaining (ascending).
  - For cards with only `next_due_mileage`: sort by km remaining (ascending).
  - Cards with no `next_due_date` and no `next_due_mileage` (never completed) sort to the **bottom**.
- A card is considered overdue if either dimension is overdue: `next_due_date < today` OR `next_due_mileage < current_vehicle_mileage`. All overdue cards (regardless of which dimension triggered it) rank at the top of urgency sort.
- Within the overdue group: cards overdue on the date dimension sort before cards overdue only on mileage.

---

## 7. Soft Delete Cascade Behaviour

| Action | Cascade |
|---|---|
| Delete `Vehicle` | Soft-deletes all its `MaintenanceCard` records. Sets all `pending`/`processing` `BackgroundJob` records referencing those cards to `cancelled`. |
| Delete `MaintenanceCard` | Sets all `pending`/`processing` `BackgroundJob` records for that card to `cancelled`. `MaintenanceHistory` records are retained. The history endpoint (`GET /vehicles/:id/maintenance-cards/:cardId/history`) continues to return history even when the card is soft-deleted. The card ownership/existence check for this endpoint must use `withDeleted: true` on the `MaintenanceCard` query to bypass the default soft-delete filter. Vehicle ownership check still applies (404 if vehicle is deleted or owned by another user). |
| `GET /vehicles/:id` on deleted vehicle | Returns 404. |
| `GET /vehicles/:id/maintenance-cards` on deleted vehicle | Returns 404. |

---

## 8. Environment Variables

### Backend & Worker
| Variable | Description |
|---|---|
| `MILEAGE_WARNING_THRESHOLD_KM` | Remaining km before card turns warning colour (always in km; mile vehicles are converted) |
| `NOTIFICATION_DAYS_BEFORE` | Days before due date to send the upcoming reminder email |
| `NOTIFICATION_CRON_SCHEDULE` | Cron expression for scheduler (e.g. `0 8 * * *`) |
| `EMAIL_PROVIDER` | `postmark` or `ses` |
| `POSTMARK_API_KEY` | Postmark API key |
| `POSTMARK_FROM_ADDRESS` | Sender email address for Postmark |
| `AWS_SES_REGION` | AWS SES region |
| `AWS_SES_FROM_ADDRESS` | Sender email address for SES |
| `FIREBASE_PROJECT_ID` | Firebase Admin SDK |
| `FIREBASE_CLIENT_EMAIL` | Firebase Admin SDK |
| `FIREBASE_PRIVATE_KEY` | Firebase Admin SDK |
| `REDIS_URL` | BullMQ Redis connection string |
| `DATABASE_HOST` | PostgreSQL (existing) |
| `DATABASE_PORT` | PostgreSQL (existing) |
| `DATABASE_USER` | PostgreSQL (existing) |
| `DATABASE_PASSWORD` | PostgreSQL (existing) |
| `DATABASE_DB` | PostgreSQL (existing) |

---

## 9. Non-Functional Requirements (MVP)

- Web app accessible from any device (responsive design).
- Google Login only (no email/password).
- Unlimited vehicles per user.
- Single mileage warning threshold (in km) shared across all maintenance cards, controlled by env var.
- Single notification lead-time shared across all maintenance cards, controlled by env var.
