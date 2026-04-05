# Mileage Prompt Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-device `localStorage`-only mileage prompt suppression with a `mileage_last_updated_at` DB column so the prompt is skipped cross-device when the user already recorded mileage today.

**Architecture:** New `PATCH /vehicles/:id/mileage` endpoint (`recordMileage`) sets `mileageLastUpdatedAt` on the vehicle. `MileagePrompt` uses that field (from the existing vehicle query) to decide visibility; `localStorage` is kept only for the dismiss-without-update case. `MaintenanceCardService.markDone` also calls `recordMileage` so logging a service suppresses the prompt for the day.

**Tech Stack:** NestJS + TypeORM (backend), Next.js 15 + TanStack Query (frontend), Vitest (tests), class-validator (DTOs), pnpm monorepo with `just` top-level commands.

---

## File Map

| Status | File | What changes |
|---|---|---|
| Modify | `packages/types/src/dtos/vehicle.dto.ts` | Add `IRecordMileageReqDTO`; add `mileageLastUpdatedAt` to `IVehicleResDTO` |
| Modify | `backend/src/db/entities/vehicle.entity.ts` | Add `mileageLastUpdatedAt` column |
| Create | `backend/src/db/migrations/<timestamp>-AddMileageLastUpdatedAtToVehicles.ts` | Generated migration |
| Create | `backend/src/modules/vehicle/dtos/record-mileage.dto.ts` | NestJS DTO for PATCH :id/mileage |
| Create | `backend/src/modules/vehicle/dtos/record-mileage.dto.spec.ts` | DTO validation tests |
| Modify | `backend/src/modules/vehicle/services/vehicle.service.ts` | Add `recordMileage` method |
| Modify | `backend/src/modules/vehicle/services/vehicle.service.spec.ts` | Tests for `recordMileage` |
| Modify | `backend/src/modules/vehicle/controllers/vehicle.controller.ts` | Add endpoint + update `toResDTO` |
| Modify | `backend/src/modules/vehicle/controllers/vehicle.controller.spec.ts` | Tests for new endpoint |
| Modify | `backend/src/modules/maintenance-card/services/maintenance-card.service.ts` | Update `markDone` |
| Modify | `backend/src/modules/maintenance-card/services/maintenance-card.service.spec.ts` | Update `markDone` tests |
| Create | `frontend/src/hooks/mutations/vehicles/useRecordMileage.ts` | New mutation hook |
| Create | `frontend/src/hooks/mutations/vehicles/useRecordMileage.spec.ts` | Hook tests |
| Modify | `frontend/src/components/vehicles/mileage-prompt.tsx` | Refactor component |
| Modify | `frontend/src/components/vehicles/mileage-prompt.spec.tsx` | Rewrite spec |
| Modify | `frontend/src/components/pages/vehicle-dashboard-page.tsx` | Pass `mileageLastUpdatedAt` prop |

---

## Task 1: Update shared types

**Files:**
- Modify: `packages/types/src/dtos/vehicle.dto.ts`

- [ ] **Step 1: Update vehicle.dto.ts**

Replace the entire file contents:

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
}

export interface IUpdateVehicleReqDTO {
  brand?: string;
  model?: string;
  colour?: string;
  mileage?: number;
  mileageUnit?: MileageUnit;
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
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Build the types package**

```bash
cd packages/types && pnpm build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/types/src/dtos/vehicle.dto.ts
git commit -m "add IRecordMileageReqDTO and mileageLastUpdatedAt to IVehicleResDTO"
```

---

## Task 2: Add VehicleEntity column and generate migration

**Files:**
- Modify: `backend/src/db/entities/vehicle.entity.ts`
- Create: `backend/src/db/migrations/<timestamp>-AddMileageLastUpdatedAtToVehicles.ts` (generated)

> **Prerequisite:** Docker services must be running (`just up`) for migration generation and execution.

- [ ] **Step 1: Add column to VehicleEntity**

In `backend/src/db/entities/vehicle.entity.ts`, add the new column after the `mileageUnit` column:

```ts
@Column({
  type: 'timestamptz',
  name: 'mileage_last_updated_at',
  nullable: true,
  default: null,
})
mileageLastUpdatedAt: Date | null;
```

Full file after change:

```ts
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MILEAGE_UNITS } from '@project/types';
import type { MileageUnit } from '@project/types';
import { UserEntity } from './user.entity';
import { MaintenanceCardEntity } from './maintenance-card.entity';
import { decimalTransformer } from '../transformers/decimal.transformer';
import { UuidV7BaseEntity } from './base.entity';

@Entity('vehicles')
export class VehicleEntity extends UuidV7BaseEntity {
  @Index()
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'varchar' })
  brand: string;

  @Column({ type: 'varchar' })
  model: string;

  @Column({ type: 'varchar' })
  colour: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  mileage: number;

  @Column({
    type: 'enum',
    enum: Object.values(MILEAGE_UNITS),
    name: 'mileage_unit',
    default: MILEAGE_UNITS.KM,
  })
  mileageUnit: MileageUnit;

  @Column({
    type: 'timestamptz',
    name: 'mileage_last_updated_at',
    nullable: true,
    default: null,
  })
  mileageLastUpdatedAt: Date | null;

  @OneToMany(() => MaintenanceCardEntity, (card) => card.vehicle, {
    cascade: ['soft-remove'],
  })
  maintenanceCards: MaintenanceCardEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
```

- [ ] **Step 2: Generate migration**

```bash
just db-generate-migrate AddMileageLastUpdatedAtToVehicles
```

Expected: a new file appears at `backend/src/db/migrations/<timestamp>-AddMileageLastUpdatedAtToVehicles.ts` with `ALTER TABLE "vehicles" ADD "mileage_last_updated_at"`.

- [ ] **Step 3: Run migration**

```bash
cd backend && pnpm run migration:run
```

Expected: migration runs successfully against the local database.

- [ ] **Step 4: Commit**

```bash
git add backend/src/db/entities/vehicle.entity.ts backend/src/db/migrations/
git commit -m "add mileage_last_updated_at column to vehicles"
```

---

## Task 3: RecordMileageDto

**Files:**
- Create: `backend/src/modules/vehicle/dtos/record-mileage.dto.spec.ts`
- Create: `backend/src/modules/vehicle/dtos/record-mileage.dto.ts`

- [ ] **Step 1: Write the failing spec**

Create `backend/src/modules/vehicle/dtos/record-mileage.dto.spec.ts`:

```ts
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { describe, it, expect } from 'vitest';
import { RecordMileageDto } from './record-mileage.dto';

describe('RecordMileageDto', () => {
  it('accepts a valid positive mileage', async () => {
    const dto = plainToInstance(RecordMileageDto, { mileage: 1000 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts zero mileage', async () => {
    const dto = plainToInstance(RecordMileageDto, { mileage: 0 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a negative mileage', async () => {
    const dto = plainToInstance(RecordMileageDto, { mileage: -1 });
    const errors = await validate(dto);
    const mileageErrors = errors.find((e) => e.property === 'mileage');
    expect(mileageErrors).toBeDefined();
  });

  it('rejects a value above 1_000_000', async () => {
    const dto = plainToInstance(RecordMileageDto, { mileage: 1_000_001 });
    const errors = await validate(dto);
    const mileageErrors = errors.find((e) => e.property === 'mileage');
    expect(mileageErrors).toBeDefined();
  });

  it('rejects a non-number mileage', async () => {
    const dto = plainToInstance(RecordMileageDto, { mileage: 'abc' });
    const errors = await validate(dto);
    const mileageErrors = errors.find((e) => e.property === 'mileage');
    expect(mileageErrors).toBeDefined();
  });

  it('rejects missing mileage', async () => {
    const dto = plainToInstance(RecordMileageDto, {});
    const errors = await validate(dto);
    const mileageErrors = errors.find((e) => e.property === 'mileage');
    expect(mileageErrors).toBeDefined();
  });
});
```

- [ ] **Step 2: Run spec to confirm it fails**

```bash
cd backend && pnpm exec vitest run src/modules/vehicle/dtos/record-mileage.dto.spec.ts
```

Expected: FAIL — `RecordMileageDto` not found.

- [ ] **Step 3: Create RecordMileageDto**

Create `backend/src/modules/vehicle/dtos/record-mileage.dto.ts`:

```ts
import { IsNumber, Max, Min } from 'class-validator';
import type { IRecordMileageReqDTO } from '@project/types';

export class RecordMileageDto implements IRecordMileageReqDTO {
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  mileage: number;
}
```

- [ ] **Step 4: Run spec to confirm it passes**

```bash
cd backend && pnpm exec vitest run src/modules/vehicle/dtos/record-mileage.dto.spec.ts
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/vehicle/dtos/record-mileage.dto.ts backend/src/modules/vehicle/dtos/record-mileage.dto.spec.ts
git commit -m "add RecordMileageDto"
```

---

## Task 4: VehicleService.recordMileage

**Files:**
- Modify: `backend/src/modules/vehicle/services/vehicle.service.spec.ts`
- Modify: `backend/src/modules/vehicle/services/vehicle.service.ts`

- [ ] **Step 1: Add tests to vehicle.service.spec.ts**

Update `baseVehicle` to include `mileageLastUpdatedAt`:

```ts
const baseVehicle = {
  id: vehicleId,
  userId,
  brand: 'Honda',
  model: 'PCX',
  colour: 'White',
  mileage: 1000,
  mileageUnit: 'km',
  mileageLastUpdatedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};
```

Add a new `describe('#recordMileage', ...)` block after the existing `#updateVehicle` block:

```ts
describe('#recordMileage', () => {
  it('updates mileage and sets mileageLastUpdatedAt', async () => {
    const now = new Date('2026-04-05T10:00:00Z');
    vi.setSystemTime(now);

    const updated = { ...baseVehicle, mileage: 1500, mileageLastUpdatedAt: now };
    mockVehicleRepository.getOne.mockResolvedValue({ ...baseVehicle });
    mockVehicleRepository.updateWithSave.mockResolvedValue([updated]);

    const result = await service.recordMileage({
      id: vehicleId,
      userId,
      mileage: 1500,
    });

    expect(mockVehicleRepository.updateWithSave).toHaveBeenCalledWith({
      dataArray: [
        expect.objectContaining({
          mileage: 1500,
          mileageLastUpdatedAt: now,
        }),
      ],
    });
    expect(result).toEqual(updated);

    vi.useRealTimers();
  });

  it('sets mileageLastUpdatedAt even when mileage equals current value', async () => {
    const now = new Date('2026-04-05T10:00:00Z');
    vi.setSystemTime(now);

    const updated = { ...baseVehicle, mileageLastUpdatedAt: now };
    mockVehicleRepository.getOne.mockResolvedValue({ ...baseVehicle });
    mockVehicleRepository.updateWithSave.mockResolvedValue([updated]);

    await service.recordMileage({ id: vehicleId, userId, mileage: 1000 });

    expect(mockVehicleRepository.updateWithSave).toHaveBeenCalledWith({
      dataArray: [expect.objectContaining({ mileageLastUpdatedAt: now })],
    });

    vi.useRealTimers();
  });

  it('throws NotFoundException when vehicle not found', async () => {
    mockVehicleRepository.getOne.mockResolvedValue(null);

    await expect(
      service.recordMileage({ id: vehicleId, userId, mileage: 1500 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when mileage is below current vehicle mileage', async () => {
    mockVehicleRepository.getOne.mockResolvedValue({ ...baseVehicle });

    await expect(
      service.recordMileage({ id: vehicleId, userId, mileage: 999 }),
    ).rejects.toThrow(BadRequestException);
  });
});
```

- [ ] **Step 2: Run spec to confirm new tests fail**

```bash
cd backend && pnpm exec vitest run src/modules/vehicle/services/vehicle.service.spec.ts
```

Expected: FAIL — `recordMileage` is not a function.

- [ ] **Step 3: Implement recordMileage in vehicle.service.ts**

Add the following method to `VehicleService` after `updateVehicle`:

```ts
async recordMileage(params: {
  id: string;
  userId: string;
  mileage: number;
}): Promise<VehicleEntity> {
  const { id, userId, mileage } = params;
  const vehicle = await this.getVehicle(id, userId);
  if (mileage < vehicle.mileage) {
    throw new BadRequestException(
      'New mileage cannot be less than the current mileage',
    );
  }
  vehicle.mileage = mileage;
  vehicle.mileageLastUpdatedAt = new Date();
  const [updated] = await this.vehicleRepository.updateWithSave({
    dataArray: [vehicle],
  });
  return updated;
}
```

- [ ] **Step 4: Run spec to confirm all tests pass**

```bash
cd backend && pnpm exec vitest run src/modules/vehicle/services/vehicle.service.spec.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/vehicle/services/vehicle.service.ts backend/src/modules/vehicle/services/vehicle.service.spec.ts
git commit -m "add recordMileage method to VehicleService"
```

---

## Task 5: VehicleController — new endpoint and toResDTO update

**Files:**
- Modify: `backend/src/modules/vehicle/controllers/vehicle.controller.spec.ts`
- Modify: `backend/src/modules/vehicle/controllers/vehicle.controller.ts`

- [ ] **Step 1: Update controller spec**

In `vehicle.controller.spec.ts`:

1. Add `recordMileage: vi.fn()` to `mockVehicleService`:

```ts
const mockVehicleService = {
  listVehicles: vi.fn(),
  getVehicle: vi.fn(),
  createVehicle: vi.fn(),
  updateVehicle: vi.fn(),
  deleteVehicle: vi.fn(),
  recordMileage: vi.fn(),
};
```

2. Add `mileageLastUpdatedAt: null` to `baseVehicle`:

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
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};
```

3. Add assertions to the existing `GET /vehicles` and `GET /vehicles/:id` tests to verify `mileageLastUpdatedAt` is mapped:

```ts
it('GET /vehicles returns list', async () => {
  mockVehicleService.listVehicles.mockResolvedValue([baseVehicle]);
  const result = await controller.list(authUser);
  expect(result).toHaveLength(1);
  expect(mockVehicleService.listVehicles).toHaveBeenCalledWith(authUser.id);
  expect(typeof result[0].createdAt).toBe('string');
  expect(typeof result[0].updatedAt).toBe('string');
  expect(result[0].mileageLastUpdatedAt).toBeNull();
});

it('GET /vehicles/:id returns vehicle with ISO date strings', async () => {
  const vehicleWithTimestamp = {
    ...baseVehicle,
    mileageLastUpdatedAt: new Date('2026-04-05T10:00:00Z'),
  };
  mockVehicleService.getVehicle.mockResolvedValue(vehicleWithTimestamp);
  const result = await controller.getOne('vehicle-1', authUser);
  expect(result.id).toBe('vehicle-1');
  expect(typeof result.createdAt).toBe('string');
  expect(typeof result.updatedAt).toBe('string');
  expect(result.mileageLastUpdatedAt).toBe('2026-04-05T10:00:00.000Z');
});
```

4. Add the new endpoint test at the end of the describe block:

```ts
it('PATCH /vehicles/:id/mileage records mileage and returns updated vehicle', async () => {
  const updated = {
    ...baseVehicle,
    mileage: 2000,
    mileageLastUpdatedAt: new Date('2026-04-05T10:00:00Z'),
  };
  mockVehicleService.recordMileage.mockResolvedValue(updated);

  const result = await controller.recordMileage(
    'vehicle-1',
    { mileage: 2000 },
    authUser,
  );

  expect(mockVehicleService.recordMileage).toHaveBeenCalledWith({
    id: 'vehicle-1',
    userId: authUser.id,
    mileage: 2000,
  });
  expect(result.mileage).toBe(2000);
  expect(result.mileageLastUpdatedAt).toBe('2026-04-05T10:00:00.000Z');
});
```

- [ ] **Step 2: Run spec to confirm new tests fail**

```bash
cd backend && pnpm exec vitest run src/modules/vehicle/controllers/vehicle.controller.spec.ts
```

Expected: FAIL — `controller.recordMileage` is not a function, `mileageLastUpdatedAt` missing from result.

- [ ] **Step 3: Update vehicle.controller.ts**

Replace the entire file:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import type { IAuthUser, IVehicleResDTO } from '@project/types';
import { CurrentUser } from 'src/modules/auth/decorators/current-user.decorator';
import { VehicleEntity } from 'src/db/entities/vehicle.entity';
import { VehicleService } from '../services/vehicle.service';
import { CreateVehicleDto } from '../dtos/create-vehicle.dto';
import { UpdateVehicleDto } from '../dtos/update-vehicle.dto';
import { RecordMileageDto } from '../dtos/record-mileage.dto';

function toResDTO(vehicle: VehicleEntity): IVehicleResDTO {
  return {
    id: vehicle.id,
    brand: vehicle.brand,
    model: vehicle.model,
    colour: vehicle.colour,
    mileage: vehicle.mileage,
    mileageUnit: vehicle.mileageUnit,
    mileageLastUpdatedAt: vehicle.mileageLastUpdatedAt?.toISOString() ?? null,
    createdAt: vehicle.createdAt.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString(),
  };
}

@Controller('vehicles')
export class VehicleController {
  constructor(private readonly vehicleService: VehicleService) {}

  @Get()
  async list(@CurrentUser() user: IAuthUser): Promise<IVehicleResDTO[]> {
    const vehicles = await this.vehicleService.listVehicles(user.id);
    return vehicles.map(toResDTO);
  }

  @Get(':id')
  async getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IAuthUser,
  ): Promise<IVehicleResDTO> {
    const vehicle = await this.vehicleService.getVehicle(id, user.id);
    return toResDTO(vehicle);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateVehicleDto,
    @CurrentUser() user: IAuthUser,
  ): Promise<IVehicleResDTO> {
    const vehicle = await this.vehicleService.createVehicle(user.id, dto);
    return toResDTO(vehicle);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVehicleDto,
    @CurrentUser() user: IAuthUser,
  ): Promise<IVehicleResDTO> {
    const vehicle = await this.vehicleService.updateVehicle(id, user.id, dto);
    return toResDTO(vehicle);
  }

  @Patch(':id/mileage')
  async recordMileage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordMileageDto,
    @CurrentUser() user: IAuthUser,
  ): Promise<IVehicleResDTO> {
    const vehicle = await this.vehicleService.recordMileage({
      id,
      userId: user.id,
      mileage: dto.mileage,
    });
    return toResDTO(vehicle);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IAuthUser,
  ): Promise<void> {
    await this.vehicleService.deleteVehicle(id, user.id);
  }
}
```

- [ ] **Step 4: Run spec to confirm all tests pass**

```bash
cd backend && pnpm exec vitest run src/modules/vehicle/controllers/vehicle.controller.spec.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/vehicle/controllers/vehicle.controller.ts backend/src/modules/vehicle/controllers/vehicle.controller.spec.ts
git commit -m "add PATCH /vehicles/:id/mileage endpoint and update toResDTO"
```

---

## Task 6: MaintenanceCardService.markDone — use recordMileage

**Files:**
- Modify: `backend/src/modules/maintenance-card/services/maintenance-card.service.spec.ts`
- Modify: `backend/src/modules/maintenance-card/services/maintenance-card.service.ts`

- [ ] **Step 1: Update the spec**

In `maintenance-card.service.spec.ts`:

1. Add `recordMileage: vi.fn()` to `mockVehicleService` (keep `updateVehicle` to avoid breaking unrelated tests):

```ts
const mockVehicleService = {
  getVehicle: vi.fn(),
  updateVehicle: vi.fn(),
  recordMileage: vi.fn(),
};
```

2. Replace the test **"auto-updates vehicle mileage when doneAtMileage > vehicle.mileage"** (around line 639):

```ts
it('records mileage via recordMileage when doneAtMileage > vehicle.mileage', async () => {
  await service.markDone(cardId, vehicleId, userId, {
    doneAtMileage: 12500,
  });

  expect(mockVehicleService.recordMileage).toHaveBeenCalledWith({
    id: vehicleId,
    userId,
    mileage: 12500,
  });
});
```

3. Replace the test **"does NOT update vehicle mileage when doneAtMileage equals vehicle current mileage"** (around line 653) — behavior now changes: `recordMileage` IS called when equal:

```ts
it('records mileage via recordMileage when doneAtMileage equals vehicle current mileage', async () => {
  // baseVehicle.mileage = 10000; equal triggers recordMileage (to update mileageLastUpdatedAt)
  await service.markDone(cardId, vehicleId, userId, {
    doneAtMileage: 10000,
  });

  expect(mockVehicleService.recordMileage).toHaveBeenCalledWith({
    id: vehicleId,
    userId,
    mileage: 10000,
  });
});
```

4. Replace `expect(mockVehicleService.updateVehicle).not.toHaveBeenCalled()` in the **"succeeds for a time-only card"** test (around line 710):

```ts
expect(mockVehicleService.recordMileage).not.toHaveBeenCalled();
```

5. Replace `expect(mockVehicleService.updateVehicle).not.toHaveBeenCalled()` in the **"does NOT update vehicle mileage when the transaction fails"** test (around line 794):

```ts
expect(mockVehicleService.recordMileage).not.toHaveBeenCalled();
```

- [ ] **Step 2: Run spec to confirm changed tests fail**

```bash
cd backend && pnpm exec vitest run src/modules/maintenance-card/services/maintenance-card.service.spec.ts
```

Expected: FAIL on the `recordMileage` assertions.

- [ ] **Step 3: Update markDone in maintenance-card.service.ts**

Replace the tail of the `markDone` method (the vehicle mileage update block after the transaction):

```ts
// before
if (typeof doneAtMileage === 'number' && doneAtMileage > vehicle.mileage) {
  await this.vehicleService.updateVehicle(vehicleId, userId, {
    mileage: doneAtMileage,
  });
}

// after
if (typeof doneAtMileage === 'number') {
  await this.vehicleService.recordMileage({
    id: vehicleId,
    userId,
    mileage: doneAtMileage,
  });
}
```

- [ ] **Step 4: Run spec to confirm all tests pass**

```bash
cd backend && pnpm exec vitest run src/modules/maintenance-card/services/maintenance-card.service.spec.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/maintenance-card/services/maintenance-card.service.ts backend/src/modules/maintenance-card/services/maintenance-card.service.spec.ts
git commit -m "update markDone to use recordMileage for mileage tracking"
```

---

## Task 7: useRecordMileage mutation hook

**Files:**
- Create: `frontend/src/hooks/mutations/vehicles/useRecordMileage.spec.ts`
- Create: `frontend/src/hooks/mutations/vehicles/useRecordMileage.ts`

- [ ] **Step 1: Write failing spec**

Create `frontend/src/hooks/mutations/vehicles/useRecordMileage.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useRecordMileage } from './useRecordMileage';
import { QueryGroup } from '../../queries/keys';
import { createWrapperWithClient } from '../../queries/test-utils';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    patch: vi.fn(),
  },
}));

import { apiClient } from '@/lib/api-client';

const mockVehicle = {
  id: 'abc-123',
  brand: 'Toyota',
  model: 'Camry',
  colour: 'White',
  mileage: 60000,
  mileageUnit: 'km',
  mileageLastUpdatedAt: '2026-04-05T10:00:00.000Z',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2026-04-05T10:00:00.000Z',
};

describe('useRecordMileage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls apiClient.patch("/vehicles/:vehicleId/mileage", data)', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue(mockVehicle);

    const { wrapper } = createWrapperWithClient();
    const { result } = renderHook(() => useRecordMileage('abc-123'), {
      wrapper,
    });

    act(() => {
      result.current.mutate({ mileage: 60000 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.patch).toHaveBeenCalledWith(
      '/vehicles/abc-123/mileage',
      { mileage: 60000 },
    );
    expect(apiClient.patch).toHaveBeenCalledTimes(1);
  });

  it('returns the updated vehicle on success', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue(mockVehicle);

    const { wrapper } = createWrapperWithClient();
    const { result } = renderHook(() => useRecordMileage('abc-123'), {
      wrapper,
    });

    act(() => {
      result.current.mutate({ mileage: 60000 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockVehicle);
  });

  it('invalidates both the individual vehicle key and the list key on success', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue(mockVehicle);

    const { wrapper, queryClient } = createWrapperWithClient();
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useRecordMileage('abc-123'), {
      wrapper,
    });

    act(() => {
      result.current.mutate({ mileage: 60000 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: [QueryGroup.VEHICLES, 'abc-123'],
      exact: true,
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: [QueryGroup.VEHICLES],
      exact: true,
    });
  });

  it('sets isError when apiClient.patch rejects and does not invalidate cache', async () => {
    vi.mocked(apiClient.patch).mockRejectedValue(new Error('Network error'));

    const { wrapper, queryClient } = createWrapperWithClient();
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useRecordMileage('abc-123'), {
      wrapper,
    });

    act(() => {
      result.current.mutate({ mileage: 60000 });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run spec to confirm it fails**

```bash
cd frontend && pnpm exec vitest run src/hooks/mutations/vehicles/useRecordMileage.spec.ts
```

Expected: FAIL — `useRecordMileage` not found.

- [ ] **Step 3: Create useRecordMileage hook**

Create `frontend/src/hooks/mutations/vehicles/useRecordMileage.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { IRecordMileageReqDTO, IVehicleResDTO } from '@project/types';
import { apiClient } from '@/lib/api-client';
import { QueryGroup } from '@/hooks/queries/keys';

export const useRecordMileage = (vehicleId: string) => {
  const queryClient = useQueryClient();

  return useMutation<IVehicleResDTO, Error, IRecordMileageReqDTO>({
    mutationFn: (data) =>
      apiClient.patch<IVehicleResDTO>(`/vehicles/${vehicleId}/mileage`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [QueryGroup.VEHICLES, vehicleId],
        exact: true,
      });
      void queryClient.invalidateQueries({
        queryKey: [QueryGroup.VEHICLES],
        exact: true,
      });
    },
  });
};
```

- [ ] **Step 4: Run spec to confirm all tests pass**

```bash
cd frontend && pnpm exec vitest run src/hooks/mutations/vehicles/useRecordMileage.spec.ts
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/mutations/vehicles/useRecordMileage.ts frontend/src/hooks/mutations/vehicles/useRecordMileage.spec.ts
git commit -m "add useRecordMileage mutation hook"
```

---

## Task 8: Refactor MileagePrompt component

**Files:**
- Modify: `frontend/src/components/vehicles/mileage-prompt.spec.tsx`
- Modify: `frontend/src/components/vehicles/mileage-prompt.tsx`

- [ ] **Step 1: Rewrite the spec**

Replace `frontend/src/components/vehicles/mileage-prompt.spec.tsx` entirely:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('@/hooks/mutations/vehicles/useRecordMileage', () => ({
  useRecordMileage: vi.fn(),
}));

import { useRecordMileage } from '@/hooks/mutations/vehicles/useRecordMileage';
import {
  MileagePrompt,
  getDismissKey,
  getTodayLocalDateString,
} from './mileage-prompt';

const VEHICLE_ID = 'vehicle-123';

const renderPrompt = (mileageLastUpdatedAt: string | null = null) =>
  render(
    <MileagePrompt
      vehicleId={VEHICLE_ID}
      currentMileage={50000}
      mileageLastUpdatedAt={mileageLastUpdatedAt}
    />,
  );

describe('MileagePrompt', () => {
  const mockMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(useRecordMileage).mockReturnValue({
      mutate: mockMutate,
    } as unknown as ReturnType<typeof useRecordMileage>);
  });

  describe('visibility — DB-driven (mileageLastUpdatedAt)', () => {
    it('renders prompt when mileageLastUpdatedAt is null (never recorded)', async () => {
      renderPrompt(null);

      await waitFor(() => {
        expect(
          screen.getByText("What's your current odometer reading?"),
        ).toBeInTheDocument();
      });
    });

    it('renders prompt when mileageLastUpdatedAt is from a previous day', async () => {
      // Pin "now" to Apr 5 so the previous-day assertion is timezone-safe
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-05T10:00:00Z'));

      renderPrompt('2026-04-04T06:00:00.000Z'); // Apr 4 in any timezone

      await waitFor(() => {
        expect(
          screen.getByText("What's your current odometer reading?"),
        ).toBeInTheDocument();
      });

      vi.useRealTimers();
    });

    it('renders nothing when mileageLastUpdatedAt is today (local date)', async () => {
      // Pin "now" to Apr 5 10:00 UTC
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-05T10:00:00Z'));

      // Apr 5 06:00 UTC is Apr 5 in every timezone from UTC-5 eastward
      const { container } = renderPrompt('2026-04-05T06:00:00.000Z');

      await waitFor(() => {
        expect(container.firstChild).toBeNull();
      });

      vi.useRealTimers();
    });
  });

  describe('visibility — localStorage-driven (dismiss)', () => {
    it('renders nothing when dismissed today', async () => {
      localStorage.setItem(getDismissKey(VEHICLE_ID), getTodayLocalDateString());

      const { container } = renderPrompt(null);

      await waitFor(() => {
        expect(container.firstChild).toBeNull();
      });
    });

    it('renders prompt when dismissed on a previous day', async () => {
      localStorage.setItem(getDismissKey(VEHICLE_ID), '2026-04-04');

      renderPrompt(null);

      await waitFor(() => {
        expect(
          screen.getByText("What's your current odometer reading?"),
        ).toBeInTheDocument();
      });
    });
  });

  describe('dismiss button', () => {
    it('writes today local date string to dismiss key and hides prompt', async () => {
      renderPrompt(null);

      await waitFor(() => {
        expect(screen.getByText('Dismiss')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Dismiss'));

      await waitFor(() => {
        expect(
          screen.queryByText("What's your current odometer reading?"),
        ).not.toBeInTheDocument();
      });

      expect(localStorage.getItem(getDismissKey(VEHICLE_ID))).toBe(
        getTodayLocalDateString(),
      );
    });
  });

  describe('submit button', () => {
    it('calls recordMileage with parsed mileage and onSuccess callback', async () => {
      renderPrompt(null);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Enter mileage'),
        ).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText('Enter mileage'), {
        target: { value: '60000' },
      });
      fireEvent.click(screen.getByText('Update'));

      expect(mockMutate).toHaveBeenCalledWith(
        { mileage: 60000 },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
      // localStorage must NOT be written on submit (DB is source of truth)
      expect(localStorage.getItem(getDismissKey(VEHICLE_ID))).toBeNull();
      expect(
        screen.queryByText("What's your current odometer reading?"),
      ).toBeInTheDocument();
    });

    it('hides prompt after successful submit without writing localStorage', async () => {
      mockMutate.mockImplementation(
        (_data: unknown, options?: { onSuccess?: () => void }) => {
          options?.onSuccess?.();
        },
      );

      renderPrompt(null);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Enter mileage'),
        ).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText('Enter mileage'), {
        target: { value: '60000' },
      });
      fireEvent.click(screen.getByText('Update'));

      expect(localStorage.getItem(getDismissKey(VEHICLE_ID))).toBeNull();
      await waitFor(() => {
        expect(
          screen.queryByText("What's your current odometer reading?"),
        ).not.toBeInTheDocument();
      });
    });

    it('disables Update button when entered value is less than currentMileage', async () => {
      renderPrompt(null);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Enter mileage'),
        ).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText('Enter mileage'), {
        target: { value: '49999' },
      });

      expect(screen.getByRole('button', { name: /update/i })).toBeDisabled();
    });

    it('shows inline validation error when entered value is less than currentMileage', async () => {
      renderPrompt(null);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Enter mileage'),
        ).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText('Enter mileage'), {
        target: { value: '49999' },
      });

      expect(
        screen.getByText(/mileage cannot be less than current/i),
      ).toBeInTheDocument();
    });

    it('does not call recordMileage when entered value is less than currentMileage', async () => {
      renderPrompt(null);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Enter mileage'),
        ).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText('Enter mileage'), {
        target: { value: '49999' },
      });

      expect(mockMutate).not.toHaveBeenCalled();
    });

    it('enables Update button when entered value equals currentMileage', async () => {
      renderPrompt(null);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Enter mileage'),
        ).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText('Enter mileage'), {
        target: { value: '50000' },
      });

      expect(
        screen.getByRole('button', { name: /update/i }),
      ).not.toBeDisabled();
    });
  });

  describe('error state', () => {
    it('shows error message when mutation fails (isError=true)', async () => {
      vi.mocked(useRecordMileage).mockReturnValue({
        mutate: mockMutate,
        isError: true,
      } as unknown as ReturnType<typeof useRecordMileage>);

      renderPrompt(null);

      await waitFor(() => {
        expect(
          screen.getByText('Failed to update mileage. Please try again.'),
        ).toBeInTheDocument();
      });
    });
  });
});
```

- [ ] **Step 2: Run spec to confirm it fails**

```bash
cd frontend && pnpm exec vitest run src/components/vehicles/mileage-prompt.spec.tsx
```

Expected: FAIL — `getDismissKey`, `getTodayLocalDateString` not exported; `useRecordMileage` not mocked correctly.

- [ ] **Step 3: Rewrite mileage-prompt.tsx**

Replace `frontend/src/components/vehicles/mileage-prompt.tsx` entirely:

```tsx
'use client';

import { FC, useEffect, useState } from 'react';
import { useRecordMileage } from '@/hooks/mutations/vehicles/useRecordMileage';
import { Button } from '@/components/ui/button';

interface MileagePromptProps {
  vehicleId: string;
  currentMileage: number;
  mileageLastUpdatedAt: string | null;
}

const isSameLocalDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const getTodayLocalDateString = (): string => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const getDismissKey = (vehicleId: string): string =>
  `dismissMileagePromptDate_${vehicleId}`;

export const MileagePrompt: FC<MileagePromptProps> = ({
  vehicleId,
  currentMileage,
  mileageLastUpdatedAt,
}) => {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState('');
  const { mutate: recordMileage, isError } = useRecordMileage(vehicleId);

  useEffect(() => {
    const updatedToday =
      mileageLastUpdatedAt !== null &&
      isSameLocalDay(new Date(mileageLastUpdatedAt), new Date());

    const dismissedDate = localStorage.getItem(getDismissKey(vehicleId));
    const dismissedToday = dismissedDate === getTodayLocalDateString();

    if (!updatedToday && !dismissedToday) {
      setVisible(true);
    }
  }, [vehicleId, mileageLastUpdatedAt]);

  const dismiss = () => {
    localStorage.setItem(getDismissKey(vehicleId), getTodayLocalDateString());
    setVisible(false);
  };

  const parsedValue = parseFloat(value.trim());
  const isBelowCurrent = !isNaN(parsedValue) && parsedValue < currentMileage;

  const handleSubmit = () => {
    if (isNaN(parsedValue) || isBelowCurrent) return;
    recordMileage({ mileage: parsedValue }, { onSuccess: () => setVisible(false) });
  };

  if (!visible) return null;

  return (
    <div className="rounded-lg border bg-muted p-4">
      <p className="mb-2 text-sm font-medium">
        What&apos;s your current odometer reading?
      </p>
      {isError && (
        <p className="text-destructive mb-2 text-xs">
          Failed to update mileage. Please try again.
        </p>
      )}
      {isBelowCurrent && (
        <p className="text-destructive mb-2 text-xs">
          Mileage cannot be less than current ({currentMileage})
        </p>
      )}
      <div className="flex gap-2">
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter mileage"
          className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!value.trim() || isNaN(parsedValue) || isBelowCurrent}
        >
          Update
        </Button>
        <Button size="sm" variant="ghost" onClick={dismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run spec to confirm all tests pass**

```bash
cd frontend && pnpm exec vitest run src/components/vehicles/mileage-prompt.spec.tsx
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/vehicles/mileage-prompt.tsx frontend/src/components/vehicles/mileage-prompt.spec.tsx
git commit -m "refactor MileagePrompt to use DB-driven visibility and new localStorage key format"
```

---

## Task 9: Update VehicleDashboardPage caller site

**Files:**
- Modify: `frontend/src/components/pages/vehicle-dashboard-page.tsx`

- [ ] **Step 1: Add mileageLastUpdatedAt prop to MileagePrompt**

In `frontend/src/components/pages/vehicle-dashboard-page.tsx`, find the `<MileagePrompt>` usage and add the new prop:

```tsx
<MileagePrompt
  vehicleId={vehicleId}
  currentMileage={vehicle.mileage}
  mileageLastUpdatedAt={vehicle.mileageLastUpdatedAt}
/>
```

- [ ] **Step 2: Run affected specs to confirm no regressions**

```bash
cd frontend && pnpm exec vitest run src/components/pages/vehicle-dashboard-page.spec.tsx
```

Expected: all tests pass (MileagePrompt is mocked as `() => null` in the spec, so no change required there).

- [ ] **Step 3: Run full test suite**

```bash
just test-unit
```

Expected: all unit tests pass across all workspaces.

- [ ] **Step 4: Format and lint**

```bash
just format && just lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/pages/vehicle-dashboard-page.tsx
git commit -m "pass mileageLastUpdatedAt to MileagePrompt in VehicleDashboardPage"
```
