# Design: Mileage Prompt Refactor

**Date:** 2026-04-05
**Branch:** `refactor/000/mileage-prompt-refactoring`
**Ref:** `docs/refactor-pending-list/001-mileage-prompt-refactor.md`

---

## Problem

The daily mileage prompt stores its "already prompted today" state in `localStorage`. This means:
- Switching devices re-prompts the user even if they already updated today
- Incognito mode re-prompts on every session

## Solution Summary

Move the "mileage last recorded" state to the database (`mileage_last_updated_at` on the `vehicles` table). The frontend checks this field to suppress the prompt when the user has already updated their mileage today (on any device).

`localStorage` is retained **only** for the dismiss-without-update case — if the user dismisses the prompt without submitting a new mileage, it suppresses re-prompting on the same device for the rest of the day. This is intentional: switching devices should re-prompt after a dismiss (the user hasn't actually recorded their mileage).

---

## Data Model

### `VehicleEntity` — new column

```ts
@Column({ type: 'timestamptz', name: 'mileage_last_updated_at', nullable: true })
mileageLastUpdatedAt: Date | null;
```

- `null` = never recorded via prompt or mark-done (correct default for existing vehicles after migration)
- Set to `new Date()` by `recordMileage` service method

### `packages/types` — `IVehicleResDTO`

Add:
```ts
mileageLastUpdatedAt: string | null;  // ISO timestamp, null if never recorded
```

### `packages/types` — new `IRecordMileageReqDTO`

```ts
export interface IRecordMileageReqDTO {
  mileage: number;
}
```

---

## Backend API

### New service method: `VehicleService.recordMileage`

```ts
async recordMileage(params: { id: string; userId: string; mileage: number }): Promise<VehicleEntity>
```

- Fetches vehicle (throws `NotFoundException` if not found)
- Throws `BadRequestException` if `mileage < vehicle.mileage`
- Sets `vehicle.mileage = mileage` and `vehicle.mileageLastUpdatedAt = new Date()`
- Saves and returns updated entity

The existing `updateVehicle` method is unchanged — it never touches `mileageLastUpdatedAt`.

### New backend DTO class: `RecordMileageDto`

Created in `backend/src/modules/vehicle/dtos/record-mileage.dto.ts`. Validates `mileage` is a positive number, using `IRecordMileageReqDTO` as the type contract.

### New endpoint: `PATCH /vehicles/:id/mileage`

```ts
@Patch(':id/mileage')
async recordMileage(
  @Param('id', ParseUUIDPipe) id: string,
  @Body() dto: RecordMileageDto,
  @CurrentUser() user: IAuthUser,
): Promise<IVehicleResDTO>
```

Used exclusively by `MileagePrompt`. Returns full `IVehicleResDTO` (including updated `mileageLastUpdatedAt`).

### `toResDTO` update

```ts
mileageLastUpdatedAt: vehicle.mileageLastUpdatedAt?.toISOString() ?? null,
```

### `MaintenanceCardService.markDone` update

Replace the existing conditional `updateVehicle` call with `recordMileage`:

```ts
// before — only fires when doneAtMileage > vehicle.mileage
if (typeof doneAtMileage === 'number' && doneAtMileage > vehicle.mileage) {
  await this.vehicleService.updateVehicle(vehicleId, userId, { mileage: doneAtMileage });
}

// after — fires whenever doneAtMileage is provided (equal or greater)
if (typeof doneAtMileage === 'number') {
  await this.vehicleService.recordMileage({ id: vehicleId, userId, mileage: doneAtMileage });
}
```

The condition broadens from `>` to `>= vehicle.mileage` (the `recordMileage` guard rejects `<`). This ensures `mileageLastUpdatedAt` is always set when a service is logged with a mileage reading, even if the reading equals the current vehicle mileage. The prompt is suppressed for the rest of the day after any mark-done with a mileage value.

---

## Database Migration

Generated via:
```bash
just db-generate-migrate AddMileageLastUpdatedAtToVehicles
```

Run after adding the column to `VehicleEntity`. Migration adds `mileage_last_updated_at` (timestamptz, nullable) to the `vehicles` table. No data backfill — existing rows default to `null`.

---

## Frontend

### New mutation hook: `useRecordMileage(vehicleId)`

- Calls `PATCH /vehicles/:id/mileage` with `IRecordMileageReqDTO`
- On success, invalidates `[QueryGroup.VEHICLES, vehicleId]` (exact) and `[QueryGroup.VEHICLES]` (exact)

### `MileagePrompt` changes

**New prop:** `mileageLastUpdatedAt: string | null`

**localStorage key format change:**

| | Old | New |
|---|---|---|
| Key | `mileage_prompted_${vehicleId}_${YYYY-MM-DD}` | `dismissMileagePromptDate_${vehicleId}` |
| Value | `'1'` | `'YYYY-MM-DD'` (local date string) |

Old approach accumulated one key per day per vehicle indefinitely. New approach uses one fixed key per vehicle, storing the dismissed date as the value — overwritten on each dismiss.

**Visibility logic:**

```ts
useEffect(() => {
  const updatedToday = mileageLastUpdatedAt !== null &&
    isSameLocalDay(new Date(mileageLastUpdatedAt), new Date());

  const dismissKey = `dismissMileagePromptDate_${vehicleId}`;
  const dismissedDate = localStorage.getItem(dismissKey);
  const dismissedToday = dismissedDate === getTodayLocalDateString();

  if (!updatedToday && !dismissedToday) {
    setVisible(true);
  }
}, [vehicleId, mileageLastUpdatedAt]);
```

Where:
- `isSameLocalDay(a, b)` compares `getFullYear`, `getMonth`, `getDate` in local timezone
- `getTodayLocalDateString()` returns `YYYY-MM-DD` in local timezone

**Date comparison is always in the user's local timezone** — consistent with the spec requirement that a new calendar day (regardless of time) triggers re-prompting.

**On dismiss:** writes today's local date string to the fixed key.

**On submit:** calls `useRecordMileage` instead of `usePatchVehicle`. No localStorage write on success (DB is source of truth for "updated today").

**Caller site:** passes `mileageLastUpdatedAt` from the vehicle query data into `MileagePrompt`.

---

## Touch Point Summary

| Layer | Change |
|---|---|
| `packages/types` | Add `mileageLastUpdatedAt` to `IVehicleResDTO`; add `IRecordMileageReqDTO` |
| DB migration | Add `mileage_last_updated_at` (timestamptz, nullable) to `vehicles` |
| `VehicleEntity` | Add `mileageLastUpdatedAt: Date \| null` column |
| `VehicleService` | Add `recordMileage` method |
| `RecordMileageDto` | New backend DTO class for `PATCH :id/mileage` request body |
| `VehicleController` | Add `PATCH :id/mileage` endpoint; update `toResDTO` |
| `MaintenanceCardService` | Replace `updateVehicle` with `recordMileage` in `markDone` |
| `useRecordMileage` | New mutation hook (+ spec) |
| `MileagePrompt` | New prop; new localStorage key format; use `useRecordMileage`; update spec |

---

## Out of Scope

- Embedding mileage fields into a TypeORM embedded entity — tracked in `docs/refactor-pending-list/003-embedding-mileage-related-field.md`
