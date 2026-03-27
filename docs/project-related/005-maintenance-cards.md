# Maintenance Cards

## Plans Covered
- Plan 05: Maintenance Card CRUD API + Vehicle delete cascade
- Plan 06: Mark Maintenance Done & Maintenance History

---

## Plan 05 — Maintenance Card Management

**Goal:** Full Maintenance Card CRUD API with vehicle ownership enforcement, server-side sort, and vehicle delete cascade.

### API Endpoints (nested under `/vehicles/:vehicleId`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/vehicles/:vehicleId/maintenance-cards` | List cards (optional `?sort=urgency\|name`) |
| `GET` | `/vehicles/:vehicleId/maintenance-cards/:id` | Get single card |
| `POST` | `/vehicles/:vehicleId/maintenance-cards` | Create card |
| `PATCH` | `/vehicles/:vehicleId/maintenance-cards/:id` | Update card fields |
| `DELETE` | `/vehicles/:vehicleId/maintenance-cards/:id` | Soft delete card |

### What was implemented

- **`ICreateMaintenanceCardReqDTO`**, **`IUpdateMaintenanceCardReqDTO`**, **`IMaintenanceCardResDTO`** in `@project/types`
- **`MaintenanceCardRepository`** — CRUD + sort logic (urgency sort: overdue first by mileage/date, then closest due; name sort: alphabetical)
- **`MaintenanceCardService`** — verifies vehicle ownership before every card operation via `VehicleService.getVehicle()`
- **`MaintenanceCardController`** — nested under `/vehicles/:vehicleId`
- **`MaintenanceCardModule`** — registered in `AppModule`; imports `VehicleModule` for ownership checks
- **Vehicle delete cascade** — `VehicleService.deleteVehicle` now also soft-deletes all cards for the vehicle via `MaintenanceCardRepository`

### Card fields
- `type`: `'task' | 'part' | 'item'`
- `name`, `description` (nullable)
- `intervalMileage` (nullable decimal), `intervalTimeMonths` (nullable int)
- `nextDueMileage`, `nextDueDate` — computed/set when marking done

### Key files
- `packages/types/src/dtos/maintenance-card.dto.ts`
- `backend/src/modules/maintenance-card/repositories/maintenance-card.repository.ts`
- `backend/src/modules/maintenance-card/services/maintenance-card.service.ts`
- `backend/src/modules/maintenance-card/controllers/maintenance-card.controller.ts`
- `backend/src/modules/maintenance-card/maintenance-card.module.ts`

---

## Plan 06 — Mark Done & Maintenance History

**Goal:** `POST .../complete` creates a `MaintenanceHistory` record, optionally updates vehicle mileage, and recomputes `nextDueMileage`/`nextDueDate` on the card.

### API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/vehicles/:vehicleId/maintenance-cards/:id/complete` | Mark maintenance done |
| `GET` | `/vehicles/:vehicleId/maintenance-cards/:id/history` | List history for card |

### What was implemented

- **`IMarkDoneReqDTO`** (`doneAtMileage?`, `notes?`) and **`IMaintenanceHistoryResDTO`** in `@project/types`
- **`MaintenanceHistoryRepository`** — create history records; `findAllByCardId` includes soft-deleted cards (history survives card soft-delete)
- **`MaintenanceHistoryService`** — wraps repository operations
- **`MaintenanceCardService.markDone`** orchestration:
  1. Validate card exists and belongs to vehicle
  2. Create `MaintenanceHistory` record
  3. If `doneAtMileage` provided and greater than vehicle's current mileage → update vehicle mileage
  4. Recompute `nextDueMileage` = `doneAtMileage + intervalMileage` (if both present)
  5. Recompute `nextDueDate` = today + `intervalTimeMonths` (if present)
- **Background job cancellation** — `markDone` also cancels any pending `BackgroundJob` records for the card (deferred from Plan 08 completion, done here)
- History endpoint returns records even when card is soft-deleted

### Key files
- `packages/types/src/dtos/maintenance-history.dto.ts`
- `backend/src/modules/maintenance-card/repositories/maintenance-history.repository.ts`
- `backend/src/modules/maintenance-card/services/maintenance-history.service.ts`
- `backend/src/modules/maintenance-card/services/maintenance-card.service.ts` — `markDone` method
