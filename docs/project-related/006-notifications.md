# Background Jobs & Notifications

## Plans Covered
- Plan 08: Background Job Infrastructure
- Plan 09: Notification Scheduler + Email

---

## Plan 08 — Background Job Infrastructure

**Goal:** BullMQ queue infrastructure, `BackgroundJobRepository` with idempotent insert, `QueueModule`, `WorkerProcessor`, `WorkerModule`, and `main-worker.ts` entry point.

### Architecture

Three new modules:
- **`background-job/`** — repository only, no HTTP
- **`queue/`** — BullMQ registration, exported for other modules to inject `Queue`
- **`worker/`** — processor + module bootstrapped by `main-worker.ts` (no HTTP server)

`WorkerProcessor` depends on an abstract `INotificationService` token so Plan 09 can supply the real implementation without changing the processor.

### What was implemented

- **`BackgroundJobRepository`**:
  - `insertIfNotExists()` — uses `ON CONFLICT DO NOTHING` via query builder (no Repository API equivalent) for idempotent job creation
  - `findPendingForRecovery()` — finds jobs in `PENDING` status scheduled in the past (for retry/recovery on startup)
  - `cancelByCardId()` — sets status to `CANCELLED` for all jobs referencing a card
- **`BACKGROUND_JOB_REFERENCE_TYPES`** constant for type-safe reference type strings
- **`QueueModule`** — registers the `'maintenance'` BullMQ queue using `REDIS_URL` from `ConfigService`; exports `Queue` for injection
- **`WorkerProcessor`** (`@Processor('maintenance')`) — processes jobs, delegates to `INotificationService`
- **`WorkerModule`** — wires processor + stub `NotificationService` (replaced in Plan 09)
- **`main-worker.ts`** — NestJS application context (no HTTP), exits only on fatal error
- **`MaintenanceCardService`** gains `BackgroundJobRepository` dependency for `cancelByCardId` on `markDone`

### Key files
- `backend/src/modules/background-job/repositories/background-job.repository.ts`
- `backend/src/modules/queue/queue.module.ts`
- `backend/src/modules/worker/worker.processor.ts`
- `backend/src/modules/worker/worker.module.ts`
- `backend/src/main-worker.ts`

---

## Plan 09 — Notification Scheduler + Email

**Goal:** Cron job that scans due/overdue cards and creates idempotent `BackgroundJob` records; real `NotificationService` that sends emails via Postmark or SES.

### Architecture

- **`SchedulerModule`** (imported by `AppModule`) — hosts `SchedulerService` with `@Cron` decorator
- **`NotificationModule`** (imported by `WorkerModule`) — hosts real `NotificationService` + `EmailService`

### What was implemented

**`MaintenanceCardRepository.findCardsForNotification(daysBefore)`:**
- Finds cards with `nextDueDate` on or before `today + daysBefore` days
- Includes overdue cards (past due date)
- Joins with `Vehicle` and `User` for email context

**`SchedulerService`** (cron, configurable via `NOTIFICATION_CRON_SCHEDULE`, default `0 8 * * *`):
1. Calls `findCardsForNotification(NOTIFICATION_DAYS_BEFORE)`
2. For each card, calls `BackgroundJobRepository.insertIfNotExists()` with idempotency key (prevents duplicate jobs)
3. Enqueues BullMQ message for the worker

**`EmailService`** — switches between Postmark and SES based on `EMAIL_PROVIDER` env var:
- `postmark` → uses `POSTMARK_API_KEY` and `POSTMARK_FROM_ADDRESS`
- `ses` → uses `AWS_SES_REGION` and `AWS_SES_FROM_ADDRESS`

**`NotificationService`** (implements `INotificationService`) — composes and sends maintenance reminder emails via `EmailService`.

**`WorkerModule`** — replaces Plan 08's stub binding with real `NotificationModule` import.

### Environment variables
- `NOTIFICATION_CRON_SCHEDULE` — cron expression (default `0 8 * * *`)
- `NOTIFICATION_DAYS_BEFORE` — how many days before due date to notify
- `EMAIL_PROVIDER` — `'postmark'` or `'ses'`
- `POSTMARK_API_KEY`, `POSTMARK_FROM_ADDRESS`
- `AWS_SES_REGION`, `AWS_SES_FROM_ADDRESS`

### Key files
- `backend/src/modules/maintenance-card/repositories/maintenance-card.repository.ts` — `findCardsForNotification`
- `backend/src/modules/scheduler/scheduler.service.ts`
- `backend/src/modules/scheduler/scheduler.module.ts`
- `backend/src/modules/notification/email.service.ts`
- `backend/src/modules/notification/notification.service.ts`
- `backend/src/modules/notification/notification.module.ts`
