# Vehicle Management

## Plans Covered
- Plan 04: Vehicle CRUD API

---

## Plan 04 — Vehicle Management

**Goal:** Full Vehicle CRUD API — list, create, get, update, soft delete — with ownership enforcement (users can only access their own vehicles).

### API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/vehicles` | List all vehicles for authenticated user |
| `GET` | `/vehicles/:id` | Get single vehicle (ownership enforced) |
| `POST` | `/vehicles` | Create vehicle |
| `PATCH` | `/vehicles/:id` | Update vehicle fields |
| `DELETE` | `/vehicles/:id` | Soft delete vehicle (returns 204) |

### What was implemented

- **`ICreateVehicleReqDTO`**, **`IUpdateVehicleReqDTO`**, **`IVehicleResDTO`** in `@project/types`
- **`VehicleRepository`** — extends `BaseDBUtil`, create/get/update/delete operations
- **`VehicleService`** — ownership enforced via `{ id, userId }` criteria; throws `NotFoundException` (404) on ownership violation
- **`VehicleController`** — maps entities to `IVehicleResDTO` (dates as ISO strings)
- **`VehicleModule`** — registered in `AppModule`

### Key architectural decisions

- **`MileageUnit` is not a TypeScript enum.** It is a frozen `const` object + derived type in `@project/types`: `MILEAGE_UNITS = Object.freeze({ KM: 'km', MILE: 'mile' } as const)`. Uses `Object.values(MILEAGE_UNITS)` for TypeORM `enum:` option and `@IsIn(Object.values(MILEAGE_UNITS))` for validation. Enums cause nominal type incompatibilities across package boundaries.
- **Ownership violation returns 404**, not 403 — avoids leaking the existence of resources.
- **Vehicle delete cascade** (soft-delete all `MaintenanceCard` records on vehicle delete) was deferred to Plan 05 when `MaintenanceCardRepository` became available.
- **All request/response fields use camelCase** (`mileageUnit`, not `mileage_unit`).

### Key files
- `packages/types/src/dtos/vehicle.dto.ts`
- `backend/src/modules/vehicle/repositories/vehicle.repository.ts`
- `backend/src/modules/vehicle/services/vehicle.service.ts`
- `backend/src/modules/vehicle/controllers/vehicle.controller.ts`
- `backend/src/modules/vehicle/dtos/create-vehicle.dto.ts`
- `backend/src/modules/vehicle/dtos/update-vehicle.dto.ts`
- `backend/src/modules/vehicle/vehicle.module.ts`
