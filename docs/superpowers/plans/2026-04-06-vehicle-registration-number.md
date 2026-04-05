# Vehicle Registration Number Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional vehicle registration number field that replaces brand+model as the primary display label when set.

**Architecture:** Nullable `varchar` column added to `vehicles` table; propagated through shared types → backend DTOs → controller serialization → frontend display helper used by `VehicleCard` and `VehicleDashboardPage`; form field with live character counter added to `VehicleFormDialog`.

**Tech Stack:** NestJS + TypeORM (backend), Next.js 15 + TanStack Query (frontend), Vitest + Testing Library (tests), class-validator (DTO validation), `@project/types` (shared interfaces).

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `packages/types/src/dtos/vehicle.dto.ts` | Modify | Add `registrationNumber` to 3 interfaces |
| `backend/src/db/entities/vehicle.entity.ts` | Modify | Add nullable column |
| `backend/src/db/migrations/<ts>-AddRegistrationNumberToVehicles.ts` | Generate | Schema migration |
| `backend/src/modules/vehicle/dtos/create-vehicle.dto.ts` | Modify | Add optional validated field |
| `backend/src/modules/vehicle/dtos/create-vehicle.dto.spec.ts` | Modify | Tests for new field |
| `backend/src/modules/vehicle/dtos/update-vehicle.dto.ts` | Modify | Add optional nullable field |
| `backend/src/modules/vehicle/dtos/update-vehicle.dto.spec.ts` | Modify | Tests for new field |
| `backend/src/modules/vehicle/controllers/vehicle.controller.ts` | Modify | Map field in `toResDTO` |
| `backend/src/modules/vehicle/controllers/vehicle.controller.spec.ts` | Modify | Tests for field in response |
| `frontend/src/lib/vehicle-display.ts` | Create | `getVehicleDisplayLabels` helper |
| `frontend/src/lib/vehicle-display.spec.ts` | Create | Tests for helper |
| `frontend/src/components/vehicles/vehicle-card.tsx` | Modify | Use helper for conditional display |
| `frontend/src/components/vehicles/vehicle-card.spec.tsx` | Modify | Tests for conditional display |
| `frontend/src/components/pages/vehicle-dashboard-page.tsx` | Modify | Use helper in header |
| `frontend/src/components/pages/vehicle-dashboard-page.spec.tsx` | Modify | Tests for conditional header |
| `frontend/src/components/vehicles/vehicle-form-dialog.tsx` | Modify | New field + live counter |
| `frontend/src/components/vehicles/vehicle-form-dialog.spec.tsx` | Modify | Tests for new field |

---

## Task 1: Update shared types

**Files:**
- Modify: `packages/types/src/dtos/vehicle.dto.ts`

No unit tests for pure interfaces. Update the three interfaces, build the package so backend and frontend can consume the change.

- [ ] **Step 1: Add `registrationNumber` to all three interfaces**

Full file content of `packages/types/src/dtos/vehicle.dto.ts`:

```ts
export const MILEAGE_UNITS = Object.freeze({
  KM: 'km',
  MILE: 'mile',
} as const);

export type MileageUnit = (typeof MILEAGE_UNITS)[keyof typeof MILEAGE_UNITS];

export interface ICreateVehicleReqDTO {
  brand: string;
  model: string;
  colour: string;
  mileage: number;
  mileageUnit: MileageUnit;
  registrationNumber?: string;
}

export interface IUpdateVehicleReqDTO {
  brand?: string;
  model?: string;
  colour?: string;
  mileage?: number;
  mileageUnit?: MileageUnit;
  registrationNumber?: string | null;
}

export interface IRecordMileageReqDTO {
  mileage: number;
}

export interface IVehicleResDTO {
  id: string;
  brand: string;
  model: string;
  colour: string;
  mileage: number;
  mileageUnit: MileageUnit;
  mileageLastUpdatedAt: string | null;
  registrationNumber: string | null;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Build the package**

```bash
cd packages/types && pnpm build
```

Expected: `dist/` compiled with no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/types/src/dtos/vehicle.dto.ts
git commit -m "add registrationNumber to vehicle DTOs"
```

---

## Task 2: Backend entity + migration

**Files:**
- Modify: `backend/src/db/entities/vehicle.entity.ts`
- Generate: `backend/src/db/migrations/<timestamp>-AddRegistrationNumberToVehicles.ts`

> **Prerequisite:** Docker services must be running (`just up`) before generating the migration, as it compares entity state against a live database.

- [ ] **Step 1: Add column to `VehicleEntity`**

In `backend/src/db/entities/vehicle.entity.ts`, add after the `mileageLastUpdatedAt` column block (before the `maintenanceCards` relation):

```ts
@Column({
  type: 'varchar',
  name: 'registration_number',
  nullable: true,
  default: null,
})
registrationNumber: string | null;
```

- [ ] **Step 2: Generate the migration**

```bash
cd backend && pnpm run migration:generate --name=AddRegistrationNumberToVehicles
```

Expected: a new file appears in `backend/src/db/migrations/` named `<timestamp>-AddRegistrationNumberToVehicles.ts` containing an `ALTER TABLE "vehicles" ADD COLUMN "registration_number" varchar` statement.

- [ ] **Step 3: Run the migration**

```bash
cd backend && pnpm run migration:run
```

Expected: `Migration AddRegistrationNumberToVehicles... has been executed successfully.`

- [ ] **Step 4: Commit**

```bash
git add backend/src/db/entities/vehicle.entity.ts backend/src/db/migrations/
git commit -m "add registration_number column to vehicles"
```

---

## Task 3: Backend `CreateVehicleDto` validation

**Files:**
- Modify: `backend/src/modules/vehicle/dtos/create-vehicle.dto.spec.ts`
- Modify: `backend/src/modules/vehicle/dtos/create-vehicle.dto.ts`

- [ ] **Step 1: Write failing tests**

Add a `registrationNumber` describe block at the end of `backend/src/modules/vehicle/dtos/create-vehicle.dto.spec.ts` (before the closing `});`):

```ts
describe('registrationNumber', () => {
  it('accepts a payload without registrationNumber (field is optional)', async () => {
    const dto = plainToInstance(CreateVehicleDto, validPayload);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid registrationNumber string', async () => {
    const dto = plainToInstance(CreateVehicleDto, {
      ...validPayload,
      registrationNumber: 'FBA1234Z',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a registrationNumber exceeding 15 characters', async () => {
    const dto = plainToInstance(CreateVehicleDto, {
      ...validPayload,
      registrationNumber: 'A'.repeat(16),
    });
    const errors = await validate(dto);
    const regErrors = errors.find((e) => e.property === 'registrationNumber');
    expect(regErrors).toBeDefined();
  });

  it('accepts a registrationNumber of exactly 15 characters', async () => {
    const dto = plainToInstance(CreateVehicleDto, {
      ...validPayload,
      registrationNumber: 'A'.repeat(15),
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && pnpm exec vitest run src/modules/vehicle/dtos/create-vehicle.dto.spec.ts
```

Expected: the `rejects a registrationNumber exceeding 15 characters` test **fails** (no validation error yet).

- [ ] **Step 3: Implement validation in `CreateVehicleDto`**

Full content of `backend/src/modules/vehicle/dtos/create-vehicle.dto.ts`:

```ts
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MILEAGE_UNITS } from '@project/types';
import type { ICreateVehicleReqDTO, MileageUnit } from '@project/types';

export class CreateVehicleDto implements ICreateVehicleReqDTO {
  @IsString()
  @IsNotEmpty()
  brand: string;

  @IsString()
  @IsNotEmpty()
  model: string;

  @IsString()
  @IsNotEmpty()
  colour: string;

  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  mileage: number;

  @IsString()
  @IsIn(Object.values(MILEAGE_UNITS))
  mileageUnit: MileageUnit;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  registrationNumber?: string;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && pnpm exec vitest run src/modules/vehicle/dtos/create-vehicle.dto.spec.ts
```

Expected: all tests **pass**.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/vehicle/dtos/create-vehicle.dto.ts \
        backend/src/modules/vehicle/dtos/create-vehicle.dto.spec.ts
git commit -m "add registrationNumber validation to CreateVehicleDto"
```

---

## Task 4: Backend `UpdateVehicleDto` validation

**Files:**
- Modify: `backend/src/modules/vehicle/dtos/update-vehicle.dto.spec.ts`
- Modify: `backend/src/modules/vehicle/dtos/update-vehicle.dto.ts`

- [ ] **Step 1: Write failing tests**

Add a `registrationNumber` describe block at the end of `backend/src/modules/vehicle/dtos/update-vehicle.dto.spec.ts` (before the closing `});`):

```ts
describe('registrationNumber', () => {
  it('accepts a payload without registrationNumber', async () => {
    const dto = plainToInstance(UpdateVehicleDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid registrationNumber string', async () => {
    const dto = plainToInstance(UpdateVehicleDto, {
      registrationNumber: 'FBA1234Z',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts null registrationNumber (explicit clear)', async () => {
    const dto = plainToInstance(UpdateVehicleDto, {
      registrationNumber: null,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a registrationNumber exceeding 15 characters', async () => {
    const dto = plainToInstance(UpdateVehicleDto, {
      registrationNumber: 'A'.repeat(16),
    });
    const errors = await validate(dto);
    const regErrors = errors.find((e) => e.property === 'registrationNumber');
    expect(regErrors).toBeDefined();
  });

  it('accepts a registrationNumber of exactly 15 characters', async () => {
    const dto = plainToInstance(UpdateVehicleDto, {
      registrationNumber: 'A'.repeat(15),
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && pnpm exec vitest run src/modules/vehicle/dtos/update-vehicle.dto.spec.ts
```

Expected: the `rejects a registrationNumber exceeding 15 characters` test **fails**.

- [ ] **Step 3: Implement validation in `UpdateVehicleDto`**

Full content of `backend/src/modules/vehicle/dtos/update-vehicle.dto.ts`:

```ts
import {
  IsIn,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { MILEAGE_UNITS } from '@project/types';
import type { IUpdateVehicleReqDTO, MileageUnit } from '@project/types';

export class UpdateVehicleDto implements IUpdateVehicleReqDTO {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  brand?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  model?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  colour?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  mileage?: number;

  @IsOptional()
  @IsString()
  @IsIn(Object.values(MILEAGE_UNITS))
  mileageUnit?: MileageUnit;

  @IsOptional()
  @ValidateIf((o: UpdateVehicleDto) => o.registrationNumber !== null)
  @IsString()
  @MaxLength(15)
  registrationNumber?: string | null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && pnpm exec vitest run src/modules/vehicle/dtos/update-vehicle.dto.spec.ts
```

Expected: all tests **pass**.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/vehicle/dtos/update-vehicle.dto.ts \
        backend/src/modules/vehicle/dtos/update-vehicle.dto.spec.ts
git commit -m "add registrationNumber validation to UpdateVehicleDto"
```

---

## Task 5: Backend controller — map `registrationNumber` in `toResDTO`

**Files:**
- Modify: `backend/src/modules/vehicle/controllers/vehicle.controller.spec.ts`
- Modify: `backend/src/modules/vehicle/controllers/vehicle.controller.ts`

- [ ] **Step 1: Update `baseVehicle` mock and write failing tests**

In `vehicle.controller.spec.ts`:

1. Add `registrationNumber: null` to `baseVehicle`:

```ts
const baseVehicle = {
  id: 'vehicle-1',
  userId: 'user-1',
  brand: 'Honda',
  model: 'PCX',
  colour: 'White',
  mileage: 1000,
  mileageUnit: 'km',
  mileageLastUpdatedAt: null,
  registrationNumber: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};
```

2. Add two new tests at the end of the `VehicleController` describe block:

```ts
it('toResDTO maps registrationNumber as null when not set', async () => {
  mockVehicleService.getVehicle.mockResolvedValue(baseVehicle);
  const result = await controller.getOne('vehicle-1', authUser);
  expect(result.registrationNumber).toBeNull();
});

it('toResDTO maps registrationNumber when set', async () => {
  const vehicleWithReg = { ...baseVehicle, registrationNumber: 'FBA1234Z' };
  mockVehicleService.getVehicle.mockResolvedValue(vehicleWithReg);
  const result = await controller.getOne('vehicle-1', authUser);
  expect(result.registrationNumber).toBe('FBA1234Z');
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && pnpm exec vitest run src/modules/vehicle/controllers/vehicle.controller.spec.ts
```

Expected: the two new `toResDTO maps registrationNumber` tests **fail** (field not in response yet).

- [ ] **Step 3: Update `toResDTO` in the controller**

In `backend/src/modules/vehicle/controllers/vehicle.controller.ts`, update the `toResDTO` function:

```ts
function toResDTO(vehicle: VehicleEntity): IVehicleResDTO {
  return {
    id: vehicle.id,
    brand: vehicle.brand,
    model: vehicle.model,
    colour: vehicle.colour,
    mileage: vehicle.mileage,
    mileageUnit: vehicle.mileageUnit,
    mileageLastUpdatedAt: vehicle.mileageLastUpdatedAt?.toISOString() ?? null,
    registrationNumber: vehicle.registrationNumber,
    createdAt: vehicle.createdAt.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString(),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && pnpm exec vitest run src/modules/vehicle/controllers/vehicle.controller.spec.ts
```

Expected: all tests **pass**.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/vehicle/controllers/vehicle.controller.ts \
        backend/src/modules/vehicle/controllers/vehicle.controller.spec.ts
git commit -m "map registrationNumber in vehicle controller toResDTO"
```

---

## Task 6: Frontend helper `getVehicleDisplayLabels`

**Files:**
- Create: `frontend/src/lib/vehicle-display.spec.ts`
- Create: `frontend/src/lib/vehicle-display.ts`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/lib/vehicle-display.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { IVehicleResDTO } from '@project/types';
import { getVehicleDisplayLabels } from './vehicle-display';

const baseVehicle: IVehicleResDTO = {
  id: 'v1',
  brand: 'Honda',
  model: 'ADV 160',
  colour: 'Black',
  mileage: 100,
  mileageUnit: 'km',
  mileageLastUpdatedAt: null,
  registrationNumber: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('getVehicleDisplayLabels', () => {
  it('returns brand + model as primary and null secondary when registrationNumber is null', () => {
    const { primary, secondary } = getVehicleDisplayLabels(baseVehicle);
    expect(primary).toBe('Honda ADV 160');
    expect(secondary).toBeNull();
  });

  it('returns registrationNumber as primary and brand + model as secondary when registrationNumber is set', () => {
    const vehicle = { ...baseVehicle, registrationNumber: 'FBA1234Z' };
    const { primary, secondary } = getVehicleDisplayLabels(vehicle);
    expect(primary).toBe('FBA1234Z');
    expect(secondary).toBe('Honda ADV 160');
  });

  it('handles a registrationNumber with spaces and unicode', () => {
    const vehicle = { ...baseVehicle, registrationNumber: 'ABC 123 ü' };
    const { primary, secondary } = getVehicleDisplayLabels(vehicle);
    expect(primary).toBe('ABC 123 ü');
    expect(secondary).toBe('Honda ADV 160');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && pnpm exec vitest run src/lib/vehicle-display.spec.ts
```

Expected: **fails** with "Cannot find module './vehicle-display'".

- [ ] **Step 3: Create the helper**

Create `frontend/src/lib/vehicle-display.ts`:

```ts
import type { IVehicleResDTO } from '@project/types';

export const getVehicleDisplayLabels = (vehicle: IVehicleResDTO) => ({
  primary: vehicle.registrationNumber ?? `${vehicle.brand} ${vehicle.model}`,
  secondary: vehicle.registrationNumber
    ? `${vehicle.brand} ${vehicle.model}`
    : null,
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && pnpm exec vitest run src/lib/vehicle-display.spec.ts
```

Expected: all 3 tests **pass**.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/vehicle-display.ts \
        frontend/src/lib/vehicle-display.spec.ts
git commit -m "add getVehicleDisplayLabels helper"
```

---

## Task 7: `VehicleCard` — conditional display

**Files:**
- Modify: `frontend/src/components/vehicles/vehicle-card.spec.tsx`
- Modify: `frontend/src/components/vehicles/vehicle-card.tsx`

- [ ] **Step 1: Update mock and write failing tests**

In `vehicle-card.spec.tsx`:

1. Add `registrationNumber: null` to `mockVehicle`:

```ts
const mockVehicle: IVehicleResDTO = {
  id: 'vehicle-1',
  brand: 'Toyota',
  model: 'Camry',
  colour: 'Silver',
  mileage: 50000,
  mileageUnit: 'km',
  mileageLastUpdatedAt: null,
  registrationNumber: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};
```

2. Add two new tests at the end of the `VehicleCard` describe block:

```ts
it('shows registrationNumber as the primary label and brand+model as secondary when set', () => {
  const vehicleWithReg = { ...mockVehicle, registrationNumber: 'FBA1234Z' };
  render(<VehicleCard vehicle={vehicleWithReg} thresholdKm={500} />);
  expect(screen.getByText('FBA1234Z')).toBeInTheDocument();
  expect(screen.getByText('Toyota Camry')).toBeInTheDocument();
});

it('does not render brand+model as a secondary line when registrationNumber is null', () => {
  render(<VehicleCard vehicle={mockVehicle} thresholdKm={500} />);
  // Toyota Camry appears exactly once (as primary)
  expect(screen.getAllByText('Toyota Camry')).toHaveLength(1);
});
```

- [ ] **Step 2: Run tests to verify new tests fail**

```bash
cd frontend && pnpm exec vitest run src/components/vehicles/vehicle-card.spec.tsx
```

Expected: `shows registrationNumber as the primary label` **fails** (still rendering "Toyota Camry" as primary only).

- [ ] **Step 3: Update `VehicleCard` implementation**

Full content of `frontend/src/components/vehicles/vehicle-card.tsx`:

```tsx
'use client';

import Link from 'next/link';
import type { IVehicleResDTO } from '@project/types';
import { useMaintenanceCards } from '@/hooks/queries/maintenance-cards/useMaintenanceCards';
import { countWarningCards } from '@/lib/warning';
import { getVehicleDisplayLabels } from '@/lib/vehicle-display';

interface VehicleCardProps {
  vehicle: IVehicleResDTO;
  thresholdKm: number;
}

export function VehicleCard({ vehicle, thresholdKm }: VehicleCardProps) {
  const { data: cards = [] } = useMaintenanceCards(vehicle.id);

  const warningCount = countWarningCards(
    cards,
    vehicle.mileage,
    vehicle.mileageUnit,
    thresholdKm,
  );

  const { primary, secondary } = getVehicleDisplayLabels(vehicle);

  return (
    <Link
      href={`/vehicles/${vehicle.id}`}
      className="block rounded-lg border p-4 hover:bg-accent transition-colors"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">{primary}</p>
          {secondary && (
            <p className="text-muted-foreground text-sm">{secondary}</p>
          )}
          <p className="text-muted-foreground text-sm">{vehicle.colour}</p>
          <p className="text-muted-foreground text-sm">
            {vehicle.mileage.toLocaleString()} {vehicle.mileageUnit}
          </p>
        </div>
        {warningCount > 0 && (
          <span className="rounded-full bg-destructive px-2.5 py-0.5 text-xs font-semibold text-destructive-foreground">
            {warningCount}
          </span>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && pnpm exec vitest run src/components/vehicles/vehicle-card.spec.tsx
```

Expected: all tests **pass**.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/vehicles/vehicle-card.tsx \
        frontend/src/components/vehicles/vehicle-card.spec.tsx
git commit -m "update VehicleCard to show registrationNumber as primary label"
```

---

## Task 8: `VehicleDashboardPage` — conditional header

**Files:**
- Modify: `frontend/src/components/pages/vehicle-dashboard-page.spec.tsx`
- Modify: `frontend/src/components/pages/vehicle-dashboard-page.tsx`

- [ ] **Step 1: Update mock and write failing tests**

In `vehicle-dashboard-page.spec.tsx`:

1. Add `registrationNumber: null` to `mockVehicle`:

```ts
const mockVehicle: IVehicleResDTO = {
  id: 'vehicle-1',
  brand: 'Toyota',
  model: 'Camry',
  colour: 'Silver',
  mileage: 50000,
  mileageUnit: 'km',
  mileageLastUpdatedAt: null,
  registrationNumber: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};
```

2. Add two new tests at the end of the `VehicleDashboardPage` describe block:

```ts
it('shows registrationNumber as h1 and brand+model as secondary line when set', () => {
  vi.mocked(useVehicle).mockReturnValue({
    data: { ...mockVehicle, registrationNumber: 'FBA1234Z' },
    isLoading: false,
    isError: false,
  } as ReturnType<typeof useVehicle>);
  vi.mocked(useMaintenanceCards).mockReturnValue({
    data: [],
    isLoading: false,
  } as unknown as ReturnType<typeof useMaintenanceCards>);

  render(<VehicleDashboardPage vehicleId="vehicle-1" />);

  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('FBA1234Z');
  expect(screen.getByText('Toyota Camry')).toBeInTheDocument();
});

it('does not render brand+model as a secondary line when registrationNumber is null', () => {
  setupVehicleLoaded();
  render(<VehicleDashboardPage vehicleId="vehicle-1" />);
  // Toyota Camry appears once (as the h1 content)
  expect(screen.getAllByText('Toyota Camry')).toHaveLength(1);
});
```

- [ ] **Step 2: Run tests to verify new tests fail**

```bash
cd frontend && pnpm exec vitest run src/components/pages/vehicle-dashboard-page.spec.tsx
```

Expected: `shows registrationNumber as h1` **fails**.

- [ ] **Step 3: Update `VehicleDashboardPage`**

In `frontend/src/components/pages/vehicle-dashboard-page.tsx`:

1. Add the import at the top (after existing imports):

```ts
import { getVehicleDisplayLabels } from '@/lib/vehicle-display';
```

2. Inside `DashboardContent`, add after the `vehicle` guard block (just before the JSX return):

```ts
const { primary, secondary } = getVehicleDisplayLabels(vehicle);
```

3. Replace the `<h1>` block in the JSX (the `<div>` containing the h1 and the colour/mileage paragraph):

```tsx
<div>
  <h1 className="text-xl font-semibold">{primary}</h1>
  {secondary && (
    <p className="text-muted-foreground text-sm">{secondary}</p>
  )}
  <p className="text-muted-foreground text-sm">
    {vehicle.colour} &middot; {vehicle.mileage.toLocaleString()}{' '}
    {vehicle.mileageUnit}
  </p>
</div>
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && pnpm exec vitest run src/components/pages/vehicle-dashboard-page.spec.tsx
```

Expected: all tests **pass**.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/pages/vehicle-dashboard-page.tsx \
        frontend/src/components/pages/vehicle-dashboard-page.spec.tsx
git commit -m "update VehicleDashboardPage header to show registrationNumber"
```

---

## Task 9: `VehicleFormDialog` — registration number field + live counter

**Files:**
- Modify: `frontend/src/components/vehicles/vehicle-form-dialog.spec.tsx`
- Modify: `frontend/src/components/vehicles/vehicle-form-dialog.tsx`

- [ ] **Step 1: Update mock and write failing tests**

In `vehicle-form-dialog.spec.tsx`:

1. Add `registrationNumber: null` to `mockVehicle`:

```ts
const mockVehicle: IVehicleResDTO = {
  id: 'v1',
  brand: 'Toyota',
  model: 'Corolla',
  colour: 'Silver',
  mileage: 85000,
  mileageUnit: 'km',
  mileageLastUpdatedAt: null,
  registrationNumber: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};
```

2. Update the existing mutation payload tests to include `registrationNumber`. Find `'calls createMutation.mutate with correct data on Save in create mode'` and update the expected call:

```ts
expect(mockCreateMutate).toHaveBeenCalledWith(
  {
    brand: 'Toyota',
    model: 'Corolla',
    colour: 'Silver',
    mileage: 85000,
    mileageUnit: 'km',
    registrationNumber: undefined,
  },
  expect.objectContaining({ onSuccess: expect.any(Function) }),
);
```

Find `'calls patchMutation.mutate with correct data on Save in edit mode'` and update the expected call:

```ts
expect(mockPatchMutate).toHaveBeenCalledWith(
  {
    brand: 'Toyota',
    model: 'Corolla',
    colour: 'Silver',
    mileage: 85000,
    mileageUnit: 'km',
    registrationNumber: null,
  },
  expect.objectContaining({ onSuccess: expect.any(Function) }),
);
```

3. Add new tests at the end of the `VehicleFormDialog` describe block:

```ts
it('renders the Vehicle Registration Number field', () => {
  render(<VehicleFormDialog open={true} onOpenChange={vi.fn()} />);
  expect(
    screen.getByLabelText(/vehicle registration number/i),
  ).toBeInTheDocument();
});

it('shows character counter (0/15) when field is empty', () => {
  render(<VehicleFormDialog open={true} onOpenChange={vi.fn()} />);
  expect(screen.getByText('(0/15)')).toBeInTheDocument();
});

it('updates character counter as user types', () => {
  render(<VehicleFormDialog open={true} onOpenChange={vi.fn()} />);
  fireEvent.change(screen.getByLabelText(/vehicle registration number/i), {
    target: { value: 'FBA1234A' },
  });
  expect(screen.getByText('(8/15)')).toBeInTheDocument();
});

it('pre-fills registrationNumber from vehicle prop in edit mode', () => {
  const vehicleWithReg = { ...mockVehicle, registrationNumber: 'FBA1234Z' };
  render(
    <VehicleFormDialog
      open={true}
      onOpenChange={vi.fn()}
      vehicle={vehicleWithReg}
    />,
  );
  expect(
    screen.getByLabelText(/vehicle registration number/i),
  ).toHaveValue('FBA1234Z');
});

it('shows empty registrationNumber field in edit mode when vehicle has none', () => {
  render(
    <VehicleFormDialog
      open={true}
      onOpenChange={vi.fn()}
      vehicle={mockVehicle}
    />,
  );
  expect(
    screen.getByLabelText(/vehicle registration number/i),
  ).toHaveValue('');
});

it('includes registrationNumber as string in create payload when filled', () => {
  render(<VehicleFormDialog open={true} onOpenChange={vi.fn()} />);
  fireEvent.change(screen.getByLabelText(/vehicle registration number/i), {
    target: { value: 'ABC123' },
  });
  fireEvent.change(screen.getByLabelText(/brand/i), {
    target: { value: 'Toyota' },
  });
  fireEvent.change(screen.getByLabelText(/model/i), {
    target: { value: 'Corolla' },
  });
  fireEvent.change(screen.getByLabelText(/colour/i), {
    target: { value: 'Silver' },
  });
  fireEvent.change(screen.getByLabelText(/mileage/i), {
    target: { value: '85000' },
  });
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
  expect(mockCreateMutate).toHaveBeenCalledWith(
    expect.objectContaining({ registrationNumber: 'ABC123' }),
    expect.objectContaining({ onSuccess: expect.any(Function) }),
  );
});

it('sends null registrationNumber in edit patch when field is cleared', () => {
  const vehicleWithReg = { ...mockVehicle, registrationNumber: 'FBA1234Z' };
  render(
    <VehicleFormDialog
      open={true}
      onOpenChange={vi.fn()}
      vehicle={vehicleWithReg}
    />,
  );
  fireEvent.change(screen.getByLabelText(/vehicle registration number/i), {
    target: { value: '' },
  });
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
  expect(mockPatchMutate).toHaveBeenCalledWith(
    expect.objectContaining({ registrationNumber: null }),
    expect.objectContaining({ onSuccess: expect.any(Function) }),
  );
});
```

- [ ] **Step 2: Run tests to verify new tests fail**

```bash
cd frontend && pnpm exec vitest run src/components/vehicles/vehicle-form-dialog.spec.tsx
```

Expected: the new field tests and updated mutation payload tests **fail**.

- [ ] **Step 3: Update `VehicleFormDialog` implementation**

Full content of `frontend/src/components/vehicles/vehicle-form-dialog.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { IVehicleResDTO } from '@project/types';
import { MILEAGE_UNITS } from '@project/types';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useCreateVehicle } from '@/hooks/mutations/vehicles/useCreateVehicle';
import { usePatchVehicle } from '@/hooks/mutations/vehicles/usePatchVehicle';
import { cn } from '@/lib/utils';

interface VehicleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle?: IVehicleResDTO;
  hasCards?: boolean;
}

const inputClass =
  'w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

export function VehicleFormDialog({
  open,
  onOpenChange,
  vehicle,
  hasCards = false,
}: VehicleFormDialogProps) {
  const isEdit = !!vehicle;

  const [registrationNumber, setRegistrationNumber] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [colour, setColour] = useState('');
  const [mileage, setMileage] = useState('');
  const [mileageUnit, setMileageUnit] = useState<'km' | 'mile'>(
    MILEAGE_UNITS.KM,
  );

  useEffect(() => {
    if (open) {
      setRegistrationNumber(vehicle?.registrationNumber ?? '');
      setBrand(vehicle?.brand ?? '');
      setModel(vehicle?.model ?? '');
      setColour(vehicle?.colour ?? '');
      setMileage(vehicle?.mileage?.toString() ?? '');
      setMileageUnit(vehicle?.mileageUnit ?? MILEAGE_UNITS.KM);
    }
  }, [open, vehicle]);

  // Both hooks must be called unconditionally (Rules of Hooks).
  // Only one fires per save depending on isEdit.
  const createMutation = useCreateVehicle();
  const patchMutation = usePatchVehicle(vehicle?.id ?? '');

  const parsedMileage = parseFloat(mileage);
  const isValid =
    brand.trim().length > 0 &&
    model.trim().length > 0 &&
    colour.trim().length > 0 &&
    !isNaN(parsedMileage) &&
    parsedMileage >= 0 &&
    (!isEdit || parsedMileage >= vehicle!.mileage);

  const isPending = createMutation.isPending || patchMutation.isPending;
  const unitLocked = isEdit && hasCards;

  const mutation = isEdit ? patchMutation : createMutation;
  const successMsg = isEdit ? 'Vehicle updated' : 'Vehicle created';

  const handleSave = () => {
    const trimmedReg = registrationNumber.trim();
    mutation.mutate(
      {
        brand: brand.trim(),
        model: model.trim(),
        colour: colour.trim(),
        mileage: parsedMileage,
        mileageUnit,
        registrationNumber: isEdit ? trimmedReg || null : trimmedReg || undefined,
      },
      {
        onSuccess: () => {
          toast.success(successMsg);
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error(err.message || 'Something went wrong');
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit Vehicle' : 'Add Vehicle'}
    >
      <div className="flex flex-col gap-4">
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="vehicle-brand"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Brand <span className="text-destructive">*</span>
            </label>
            <input
              id="vehicle-brand"
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g. Toyota"
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="vehicle-model"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Model <span className="text-destructive">*</span>
            </label>
            <input
              id="vehicle-model"
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. Corolla"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="vehicle-colour"
            className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            Colour <span className="text-destructive">*</span>
          </label>
          <input
            id="vehicle-colour"
            type="text"
            value={colour}
            onChange={(e) => setColour(e.target.value)}
            placeholder="e.g. Silver"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="vehicle-mileage"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Mileage <span className="text-destructive">*</span>
            </label>
            <input
              id="vehicle-mileage"
              type="number"
              min={0}
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              placeholder="e.g. 85000"
              className={inputClass}
            />
            {isEdit &&
              !isNaN(parsedMileage) &&
              parsedMileage < vehicle!.mileage && (
                <p className="text-destructive text-xs mt-1">
                  Cannot reduce mileage below current value ({vehicle!.mileage})
                </p>
              )}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Unit {!unitLocked && <span className="text-destructive">*</span>}
            </label>
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                {([MILEAGE_UNITS.KM, MILEAGE_UNITS.MILE] as const).map(
                  (unit) => (
                    <button
                      key={unit}
                      type="button"
                      disabled={unitLocked}
                      onClick={() => setMileageUnit(unit)}
                      className={cn(
                        'rounded-md border px-3 py-1.5 text-xs',
                        mileageUnit === unit
                          ? 'border-transparent bg-primary text-primary-foreground'
                          : 'border-input bg-background',
                        unitLocked && 'cursor-not-allowed opacity-50',
                      )}
                    >
                      {unit}
                    </button>
                  ),
                )}
              </div>
              {unitLocked && (
                <span className="text-xs italic text-muted-foreground">
                  Delete all maintenance cards to edit this
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isValid || isPending}
          >
            Save
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && pnpm exec vitest run src/components/vehicles/vehicle-form-dialog.spec.tsx
```

Expected: all tests **pass**.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/vehicles/vehicle-form-dialog.tsx \
        frontend/src/components/vehicles/vehicle-form-dialog.spec.tsx
git commit -m "add registrationNumber field with live counter to VehicleFormDialog"
```

---

## Task 10: Format, lint, and final check

- [ ] **Step 1: Run format and lint**

```bash
just format && just lint
```

Expected: no errors.

- [ ] **Step 2: Run all backend unit tests**

```bash
just test-unit
```

Expected: all tests **pass**.

- [ ] **Step 3: Run all frontend unit tests**

```bash
cd frontend && pnpm exec vitest run
```

Expected: all tests **pass**.

- [ ] **Step 4: Commit if any formatting changes were auto-applied**

```bash
git add -A
git commit -m "format and lint cleanup"
```

Only commit if `git status` shows changes. If nothing changed, skip this step.
