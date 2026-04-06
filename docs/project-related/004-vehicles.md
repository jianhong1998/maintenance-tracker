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
| `PATCH` | `/vehicles/:id/mileage` | Record a mileage reading (sets `mileageLastUpdatedAt`) |
| `DELETE` | `/vehicles/:id` | Soft delete vehicle (returns 204) |

### What was implemented

- **`ICreateVehicleReqDTO`**, **`IUpdateVehicleReqDTO`**, **`IVehicleResDTO`** in `@project/types`
- **`VehicleRepository`** — extends `BaseDBUtil`, create/get/update/delete operations
- **`VehicleService`** — ownership enforced via `{ id, userId }` criteria; throws `NotFoundException` (404) on ownership violation
- **`VehicleController`** — maps entities to `IVehicleResDTO` (dates as ISO strings)
- **`VehicleModule`** — registered in `AppModule`

### Mileage update validation

`VehicleService.updateVehicle` enforces that mileage can only increase. After loading the current vehicle entity, it checks:

```ts
if (input.mileage !== undefined && input.mileage < vehicle.mileage) {
  throw new BadRequestException('New mileage cannot be less than the current mileage');
}
```

This is an application-layer guard (not a DB constraint). It is the primary enforcement point — both `MileagePrompt` and `VehicleFormDialog` also block below-current values on the frontend, but those are UX guards only; direct API calls are caught here.

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

---

## Mileage Prompt — DB-Backed Suppression

**Problem:** The daily mileage prompt used `localStorage` to track "already prompted today". This failed on device switch (re-prompted even if the user already updated their mileage) and in incognito mode (re-prompted every session).

**Solution:** Add `mileage_last_updated_at` (timestamptz, nullable) to the `vehicles` table. Set it whenever a mileage reading is recorded — either via `MileagePrompt` or via `markDone`. The frontend checks this field against today's local calendar date to decide whether to show the prompt.

**Behaviour rules:**
- If `mileageLastUpdatedAt` maps to the same local calendar day as today → suppress prompt (user has already recorded mileage today on any device).
- If the user dismisses the prompt without submitting → write today's local date string to `localStorage` key `dismissMileagePromptDate_{vehicleId}`. Suppresses re-prompting on the same device for the rest of the day.
- Dismiss-without-update is intentionally device-local: switching devices after a dismiss should re-prompt, because the user has not actually recorded their mileage.

**Decision:** A dedicated endpoint `PATCH /vehicles/:id/mileage` (via `VehicleService.recordMileage`) was introduced instead of reusing the general `PATCH /vehicles/:id`. This keeps `mileageLastUpdatedAt` as an internal system field — it is set exclusively by recorded mileage events and is never directly patchable via the general update path.

---

## Vehicle Registration Number

**Requirement:** Users can optionally record their vehicle's registration number (e.g. `SBC1234Z`). When set, it replaces brand + model as the primary display label on the home page vehicle card and the vehicle dashboard header. Brand + model moves to a secondary muted line below. When not set, display falls back to the existing `{brand} {model}` behaviour.

**Constraints:**
- Optional (nullable). Users may leave it blank.
- Max 15 UTF-8 characters (any character allowed).
- Empty string is not valid. To clear a stored value, send `null` (edit mode only).
- Stored as `varchar`. Column name: `registration_number`.
- Fallback: when null, all display surfaces revert to `{brand} {model}`.

**UI surfaces affected:**
- **Home page vehicle card:** primary label → registration number (if set), secondary → `{brand} {model}` in muted style.
- **Vehicle dashboard header:** same swap — registration number as `<h1>`, brand + model as muted secondary line.
- **Add/Edit vehicle form:** optional "Vehicle Registration Number" field inserted above Brand/Model, with live character counter (`0/15`). In edit mode, clearing the field sends `null` to explicitly remove the stored value.

---

## Vehicle CRUD — Frontend UX Decisions

### Edit / Delete button placement

Edit and Delete buttons on the home page vehicle card are placed **adjacent to the vehicle name**, not right-aligned with `justify-between`. This was a deliberate layout decision made after tester feedback.

An earlier design used a `⋮` (kebab) dropdown menu to house Edit and Delete. This was **explicitly rejected** after tester feedback — the hidden actions were hard to discover and the extra click felt unnecessary for a low-density card layout. Inline buttons were adopted instead.

This decision is not derivable from the code; it is recorded here so it is not re-litigated.
