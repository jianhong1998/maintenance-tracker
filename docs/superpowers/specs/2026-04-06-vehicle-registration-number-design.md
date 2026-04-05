# Vehicle Registration Number — Design Spec

**Date:** 2026-04-06
**Branch:** `feat/000/add-vehicle-number`
**Requirement source:** `docs/refactor-pending-list/004-vehicle-register-number/001-requirement.md`

---

## Overview

Add an optional vehicle registration number field to vehicles. When set, it replaces brand + model as the primary display label on the home page card and vehicle dashboard header. Brand + model moves to a secondary (muted) line. When not set, existing display behaviour is unchanged.

---

## Constraints

- Max 15 UTF-8 characters (any character allowed)
- Nullable — users may leave it blank
- Stored as `varchar`, column name `registration_number`
- Fallback: when null, all UI surfaces revert to current behaviour

---

## 1. Data Model

**`VehicleEntity`** — new column:

```ts
@Column({ type: 'varchar', name: 'registration_number', nullable: true, default: null })
registrationNumber: string | null;
```

**Migration:** `AddRegistrationNumberToVehicles`

---

## 2. API Contract (`packages/types`)

**`IVehicleResDTO`** — add:
```ts
registrationNumber: string | null;
```

**`ICreateVehicleReqDTO`** — add:
```ts
registrationNumber?: string;
```

**`IUpdateVehicleReqDTO`** — add:
```ts
registrationNumber?: string | null;  // null = explicit clear
```

---

## 3. Backend

### DTOs

**`CreateVehicleDto`:**
```ts
@IsOptional()
@IsString()
@MaxLength(15)
registrationNumber?: string;
```

**`UpdateVehicleDto`:**
```ts
@IsOptional()
@ValidateIf((o) => o.registrationNumber !== null)
@IsString()
@MaxLength(15)
registrationNumber?: string | null;
```

### Controller

`toResDTO` maps the new field:
```ts
registrationNumber: vehicle.registrationNumber,
```

### Service

No changes needed. `updateVehicle` already uses `Object.assign(vehicle, input)`, which handles the new field automatically.

---

## 4. Frontend — Display Logic

**New helper** `frontend/src/lib/vehicle-display.ts`:

```ts
import type { IVehicleResDTO } from '@project/types';

export const getVehicleDisplayLabels = (vehicle: IVehicleResDTO) => ({
  primary: vehicle.registrationNumber ?? `${vehicle.brand} ${vehicle.model}`,
  secondary: vehicle.registrationNumber ? `${vehicle.brand} ${vehicle.model}` : null,
});
```

Used by both `VehicleCard` and `VehicleDashboardPage`.

---

## 5. Frontend — Component Changes

### `VehicleCard` (`frontend/src/components/vehicles/vehicle-card.tsx`)

Replace the single `{vehicle.brand} {vehicle.model}` line with:

```tsx
const { primary, secondary } = getVehicleDisplayLabels(vehicle);
// ...
<p className="font-semibold">{primary}</p>
{secondary && <p className="text-muted-foreground text-sm">{secondary}</p>}
<p className="text-muted-foreground text-sm">{vehicle.colour}</p>
<p className="text-muted-foreground text-sm">
  {vehicle.mileage.toLocaleString()} {vehicle.mileageUnit}
</p>
```

### `VehicleDashboardPage` (`frontend/src/components/pages/vehicle-dashboard-page.tsx`)

Replace the `<h1>` block with:

```tsx
const { primary, secondary } = getVehicleDisplayLabels(vehicle);
// ...
<h1 className="text-xl font-semibold">{primary}</h1>
{secondary && <p className="text-muted-foreground text-sm">{secondary}</p>}
<p className="text-muted-foreground text-sm">
  {vehicle.colour} &middot; {vehicle.mileage.toLocaleString()} {vehicle.mileageUnit}
</p>
```

### `VehicleFormDialog` (`frontend/src/components/vehicles/vehicle-form-dialog.tsx`)

**New state:**
```ts
const [registrationNumber, setRegistrationNumber] = useState('');
```

**Reset in `useEffect`:**
```ts
setRegistrationNumber(vehicle?.registrationNumber ?? '');
```

**New field** (full-width, inserted above the Brand/Model grid):
```tsx
<div>
  <label
    htmlFor="vehicle-reg-number"
    className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
  >
    Vehicle Registration Number{' '}
    <span className="font-normal normal-case tracking-normal">
      ({registrationNumber.length}/15)
    </span>
  </label>
  <input
    id="vehicle-reg-number"
    type="text"
    maxLength={15}
    value={registrationNumber}
    onChange={(e) => setRegistrationNumber(e.target.value)}
    placeholder="e.g. SBC1234Z"
    className={inputClass}
  />
</div>
```

**On save** — payload includes:
```ts
mutation.mutate({
  brand: brand.trim(),
  model: model.trim(),
  colour: colour.trim(),
  mileage: parsedMileage,
  mileageUnit,
  registrationNumber: isEdit
    ? registrationNumber.trim() || null   // null explicitly clears in edit
    : registrationNumber.trim() || undefined, // omit in create (DB defaults to null)
});
```

---

## 6. Affected Files Summary

| Layer | File | Change |
|---|---|---|
| Types | `packages/types/src/dtos/vehicle.dto.ts` | Add field to 3 interfaces |
| Backend entity | `backend/src/db/entities/vehicle.entity.ts` | Add column |
| Backend migration | `backend/src/db/migrations/<timestamp>-AddRegistrationNumberToVehicles.ts` | Generated |
| Backend DTO | `backend/src/modules/vehicle/dtos/create-vehicle.dto.ts` | Add validated field |
| Backend DTO | `backend/src/modules/vehicle/dtos/update-vehicle.dto.ts` | Add validated field |
| Backend controller | `backend/src/modules/vehicle/controllers/vehicle.controller.ts` | Map field in `toResDTO` |
| Frontend lib | `frontend/src/lib/vehicle-display.ts` | New helper (new file) |
| Frontend | `frontend/src/components/vehicles/vehicle-card.tsx` | Conditional display |
| Frontend | `frontend/src/components/pages/vehicle-dashboard-page.tsx` | Conditional display |
| Frontend | `frontend/src/components/vehicles/vehicle-form-dialog.tsx` | New field + live counter |

---

## 7. Testing

- Unit tests for `getVehicleDisplayLabels`: null, empty-string edge cases, normal value
- Unit tests for `CreateVehicleDto` and `UpdateVehicleDto`: missing field, null, max-length exceeded, valid
- Update `VehicleCard` tests: reg number set / not set
- Update `VehicleFormDialog` tests: field appears, counter updates, save payload
- Update `VehicleDashboardPage` tests: reg number set / not set in header
- API integration test: create and update with reg number
