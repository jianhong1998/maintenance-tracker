# Code Review Fixes — feat/005 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve all issues identified in the feat/005 code review: break the VehicleService ↔ MaintenanceCardService circular dependency via TypeORM cascade, fix HTTP status on POST, fix a decimal column type, and remove two minor code smells.

**Architecture:** The circular dependency is eliminated by adding a `@OneToMany(cascade: ['soft-remove'])` relation on `VehicleEntity` and passing the relation to `BaseDBUtil.delete`. `VehicleService` drops its `MaintenanceCardService` dependency entirely. `MaintenanceCardService` retains its one-way dependency on `VehicleService` for ownership verification.

**Tech Stack:** NestJS, TypeORM, PostgreSQL, Vitest

---

## File Map

| File | Change |
|------|--------|
| `backend/src/db/entities/vehicle.entity.ts` | Add `@OneToMany` with `cascade: ['soft-remove']` pointing to `MaintenanceCardEntity` |
| `backend/src/modules/vehicle/services/vehicle.service.ts` | Drop `MaintenanceCardService`; call `vehicleRepository.delete` with `relation: { maintenanceCards: true }` |
| `backend/src/modules/vehicle/services/vehicle.service.spec.ts` | Remove `MaintenanceCardService` mock; update `deleteVehicle` assertions |
| `backend/src/modules/vehicle/vehicle.module.ts` | Remove `forwardRef(() => MaintenanceCardModule)` import |
| `backend/src/modules/maintenance-card/services/maintenance-card.service.ts` | Remove `deleteCardsByVehicleId`; drop `forwardRef` wrapper around `VehicleService` |
| `backend/src/modules/maintenance-card/services/maintenance-card.service.spec.ts` | Remove `deleteCardsByVehicleId` test block |
| `backend/src/modules/maintenance-card/maintenance-card.module.ts` | Remove `forwardRef()`; import `VehicleModule` directly |
| `backend/src/modules/maintenance-card/controllers/maintenance-card.controller.ts` | Add `@HttpCode(HttpStatus.CREATED)` on `@Post()`; fix double `new Date()` wrap |
| `backend/src/db/entities/maintenance-card.entity.ts` | Change `intervalMileage` column from `decimal(10,2)` to `int` |
| `backend/src/modules/maintenance-card/services/maintenance-card.service.ts` | Remove redundant `!isOverdue(c)` in `noDueInfo` filter |

---

## Task 1: Break the Circular Dependency

The `VehicleService ↔ MaintenanceCardService` circular dependency is resolved by moving cascade soft-delete to the TypeORM layer. `VehicleEntity` gains a `@OneToMany` relation with `cascade: ['soft-remove']`. `VehicleService.deleteVehicle` uses the existing `relation` parameter on `BaseDBUtil.delete` to load maintenance cards so TypeORM cascades the soft-remove automatically.

**Files:**
- Modify: `backend/src/db/entities/vehicle.entity.ts`
- Modify: `backend/src/modules/vehicle/services/vehicle.service.ts`
- Modify: `backend/src/modules/vehicle/services/vehicle.service.spec.ts`
- Modify: `backend/src/modules/vehicle/vehicle.module.ts`
- Modify: `backend/src/modules/maintenance-card/services/maintenance-card.service.ts`
- Modify: `backend/src/modules/maintenance-card/services/maintenance-card.service.spec.ts`
- Modify: `backend/src/modules/maintenance-card/maintenance-card.module.ts`

---

### Task 1a: Update `vehicle.service.spec.ts` first (red → green)

- [x] **Step 1: Update `deleteVehicle` tests — remove `MaintenanceCardService` mock**

  Replace the entire file `backend/src/modules/vehicle/services/vehicle.service.spec.ts` with the version below. Key changes:
  - Remove `mockMaintenanceCardService` constant and its `provide` entry
  - Remove the `MaintenanceCardService` import
  - Update "soft deletes the vehicle" test: assert `vehicleRepository.delete` is called with `relation: { maintenanceCards: true }`
  - Replace "deletes all maintenance cards before soft-deleting the vehicle" with a test that verifies the `relation` param is passed

  ```typescript
  import { Test, TestingModule } from '@nestjs/testing';
  import { NotFoundException } from '@nestjs/common';
  import { vi, describe, it, expect, beforeEach } from 'vitest';
  import { VehicleService } from './vehicle.service';
  import { VehicleRepository } from '../repositories/vehicle.repository';

  const mockVehicleRepository = {
    getAll: vi.fn(),
    getOne: vi.fn(),
    create: vi.fn(),
    updateWithSave: vi.fn(),
    delete: vi.fn(),
  };

  const userId = 'user-1';
  const vehicleId = 'vehicle-1';

  const baseVehicle = {
    id: vehicleId,
    userId,
    brand: 'Honda',
    model: 'PCX',
    colour: 'White',
    mileage: 1000,
    mileageUnit: 'km',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  describe('VehicleService', () => {
    let service: VehicleService;

    beforeEach(async () => {
      vi.clearAllMocks();

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          VehicleService,
          { provide: VehicleRepository, useValue: mockVehicleRepository },
        ],
      }).compile();

      service = module.get<VehicleService>(VehicleService);
    });

    describe('#listVehicles', () => {
      it('returns all vehicles for the user', async () => {
        mockVehicleRepository.getAll.mockResolvedValue([baseVehicle]);

        const result = await service.listVehicles(userId);

        expect(mockVehicleRepository.getAll).toHaveBeenCalledWith({
          criteria: { userId },
        });
        expect(result).toEqual([baseVehicle]);
      });
    });

    describe('#getVehicle', () => {
      it('returns the vehicle when it belongs to the user', async () => {
        mockVehicleRepository.getOne.mockResolvedValue(baseVehicle);

        const result = await service.getVehicle(vehicleId, userId);

        expect(result).toEqual(baseVehicle);
      });

      it('throws NotFoundException when vehicle not found or does not belong to user', async () => {
        mockVehicleRepository.getOne.mockResolvedValue(null);

        await expect(service.getVehicle(vehicleId, userId)).rejects.toThrow(
          NotFoundException,
        );
      });
    });

    describe('#createVehicle', () => {
      it('creates and returns a new vehicle', async () => {
        mockVehicleRepository.create.mockResolvedValue(baseVehicle);

        const result = await service.createVehicle(userId, {
          brand: 'Honda',
          model: 'PCX',
          colour: 'White',
          mileage: 1000,
          mileageUnit: 'km',
        });

        expect(mockVehicleRepository.create).toHaveBeenCalledWith({
          creationData: {
            userId,
            brand: 'Honda',
            model: 'PCX',
            colour: 'White',
            mileage: 1000,
            mileageUnit: 'km',
          },
        });
        expect(result).toEqual(baseVehicle);
      });
    });

    describe('#updateVehicle', () => {
      it('updates and returns the vehicle with patched fields applied', async () => {
        const updated = { ...baseVehicle, colour: 'Black' };
        mockVehicleRepository.getOne.mockResolvedValue(baseVehicle);
        mockVehicleRepository.updateWithSave.mockResolvedValue([updated]);

        const result = await service.updateVehicle(vehicleId, userId, {
          colour: 'Black',
        });

        expect(mockVehicleRepository.updateWithSave).toHaveBeenCalledWith({
          dataArray: [expect.objectContaining({ colour: 'Black' })],
        });
        expect(result).toEqual(updated);
      });

      it('throws NotFoundException when vehicle not found', async () => {
        mockVehicleRepository.getOne.mockResolvedValue(null);

        await expect(
          service.updateVehicle(vehicleId, userId, { colour: 'Black' }),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('#deleteVehicle', () => {
      it('soft deletes the vehicle with cascade to maintenance cards', async () => {
        mockVehicleRepository.getOne.mockResolvedValue(baseVehicle);
        mockVehicleRepository.delete.mockResolvedValue([baseVehicle]);

        await service.deleteVehicle(vehicleId, userId);

        expect(mockVehicleRepository.delete).toHaveBeenCalledWith({
          criteria: { id: vehicleId, userId },
          relation: { maintenanceCards: true },
        });
      });

      it('throws NotFoundException when vehicle not found', async () => {
        mockVehicleRepository.getOne.mockResolvedValue(null);

        await expect(service.deleteVehicle(vehicleId, userId)).rejects.toThrow(
          NotFoundException,
        );
      });
    });
  });
  ```

- [x] **Step 2: Run the updated spec — verify it fails**

  ```bash
  cd backend && pnpm exec vitest run src/modules/vehicle/services/vehicle.service.spec.ts
  ```
  Expected: compile error or test failure because `VehicleService` still injects `MaintenanceCardService`.

---

### Task 1b: Update `maintenance-card.service.spec.ts` — remove `deleteCardsByVehicleId` block

- [x] **Step 3: Remove the `#deleteCardsByVehicleId` describe block from the maintenance card service spec**

  In `backend/src/modules/maintenance-card/services/maintenance-card.service.spec.ts`, delete the entire `describe('#deleteCardsByVehicleId', ...)` block (lines ~356–374 at time of writing).

- [x] **Step 4: Run the spec — verify remaining tests still pass**

  ```bash
  cd backend && pnpm exec vitest run src/modules/maintenance-card/services/maintenance-card.service.spec.ts
  ```
  Expected: all remaining tests PASS.

---

### Task 1c: Add `@OneToMany` to `VehicleEntity`

- [x] **Step 5: Add the `@OneToMany` relation to `VehicleEntity`**

  In `backend/src/db/entities/vehicle.entity.ts`:
  - Add `OneToMany` to the typeorm import list
  - Add `import { MaintenanceCardEntity } from './maintenance-card.entity';` after the existing imports
  - Add the property before `createdAt`:

  ```typescript
  @OneToMany(() => MaintenanceCardEntity, (card) => card.vehicle, {
    cascade: ['soft-remove'],
  })
  maintenanceCards: MaintenanceCardEntity[];
  ```

  Final imports section should look like:
  ```typescript
  import {
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    OneToMany,
    UpdateDateColumn,
  } from 'typeorm';
  import { MILEAGE_UNITS } from '@project/types';
  import type { MileageUnit } from '@project/types';
  import { UserEntity } from './user.entity';
  import { MaintenanceCardEntity } from './maintenance-card.entity';
  import { decimalTransformer } from '../transformers/decimal.transformer';
  import { UuidV7BaseEntity } from './base.entity';
  ```

---

### Task 1d: Update `VehicleService` — drop `MaintenanceCardService`

- [x] **Step 6: Rewrite `VehicleService`**

  Replace `backend/src/modules/vehicle/services/vehicle.service.ts` with:

  ```typescript
  import { Injectable, NotFoundException } from '@nestjs/common';
  import type {
    ICreateVehicleReqDTO,
    IUpdateVehicleReqDTO,
  } from '@project/types';
  import { VehicleEntity } from 'src/db/entities/vehicle.entity';
  import { VehicleRepository } from '../repositories/vehicle.repository';

  @Injectable()
  export class VehicleService {
    constructor(private readonly vehicleRepository: VehicleRepository) {}

    async listVehicles(userId: string): Promise<VehicleEntity[]> {
      return this.vehicleRepository.getAll({ criteria: { userId } });
    }

    async getVehicle(id: string, userId: string): Promise<VehicleEntity> {
      const vehicle = await this.vehicleRepository.getOne({
        criteria: { id, userId },
      });
      if (!vehicle) throw new NotFoundException('Vehicle not found');
      return vehicle;
    }

    async createVehicle(
      userId: string,
      input: ICreateVehicleReqDTO,
    ): Promise<VehicleEntity> {
      return this.vehicleRepository.create({
        creationData: { userId, ...input },
      });
    }

    async updateVehicle(
      id: string,
      userId: string,
      input: IUpdateVehicleReqDTO,
    ): Promise<VehicleEntity> {
      const vehicle = await this.getVehicle(id, userId);
      Object.assign(vehicle, input);
      const [updated] = await this.vehicleRepository.updateWithSave({
        dataArray: [vehicle],
      });
      return updated;
    }

    async deleteVehicle(id: string, userId: string): Promise<void> {
      await this.getVehicle(id, userId);
      await this.vehicleRepository.delete({
        criteria: { id, userId },
        relation: { maintenanceCards: true },
      });
    }
  }
  ```

- [x] **Step 7: Run the vehicle service spec — verify it passes**

  ```bash
  cd backend && pnpm exec vitest run src/modules/vehicle/services/vehicle.service.spec.ts
  ```
  Expected: all tests PASS.

---

### Task 1e: Update `MaintenanceCardService` — remove `deleteCardsByVehicleId` and `forwardRef`

- [x] **Step 8: Edit `maintenance-card.service.ts`**

  In `backend/src/modules/maintenance-card/services/maintenance-card.service.ts`:
  - Remove `forwardRef` and `Inject` from the `@nestjs/common` imports
  - Change the constructor injection from:
    ```typescript
    @Inject(forwardRef(() => VehicleService))
    private readonly vehicleService: VehicleService,
    ```
    to:
    ```typescript
    private readonly vehicleService: VehicleService,
    ```
  - Delete the entire `deleteCardsByVehicleId` method (lines ~166–168).

- [x] **Step 9: Run the maintenance card service spec — all tests pass**

  ```bash
  cd backend && pnpm exec vitest run src/modules/maintenance-card/services/maintenance-card.service.spec.ts
  ```
  Expected: all tests PASS.

---

### Task 1f: Fix module wiring

- [x] **Step 10: Update `VehicleModule` — remove `forwardRef` and `MaintenanceCardModule`**

  Replace `backend/src/modules/vehicle/vehicle.module.ts` with:

  ```typescript
  import { Module } from '@nestjs/common';
  import { TypeOrmModule } from '@nestjs/typeorm';
  import { VehicleEntity } from 'src/db/entities/vehicle.entity';
  import { VehicleRepository } from './repositories/vehicle.repository';
  import { VehicleService } from './services/vehicle.service';
  import { VehicleController } from './controllers/vehicle.controller';

  @Module({
    imports: [TypeOrmModule.forFeature([VehicleEntity])],
    providers: [VehicleRepository, VehicleService],
    controllers: [VehicleController],
    exports: [VehicleService],
  })
  export class VehicleModule {}
  ```

- [x] **Step 11: Update `MaintenanceCardModule` — remove `forwardRef`**

  Replace `backend/src/modules/maintenance-card/maintenance-card.module.ts` with:

  ```typescript
  import { Module } from '@nestjs/common';
  import { TypeOrmModule } from '@nestjs/typeorm';
  import { MaintenanceCardEntity } from 'src/db/entities/maintenance-card.entity';
  import { VehicleModule } from '../vehicle/vehicle.module';
  import { MaintenanceCardRepository } from './repositories/maintenance-card.repository';
  import { MaintenanceCardService } from './services/maintenance-card.service';
  import { MaintenanceCardController } from './controllers/maintenance-card.controller';

  @Module({
    imports: [TypeOrmModule.forFeature([MaintenanceCardEntity]), VehicleModule],
    providers: [MaintenanceCardRepository, MaintenanceCardService],
    controllers: [MaintenanceCardController],
    exports: [MaintenanceCardService],
  })
  export class MaintenanceCardModule {}
  ```

- [x] **Step 12: Run all unit tests — no failures**

  ```bash
  cd backend && pnpm exec vitest run
  ```
  Expected: all tests PASS.

- [x] **Step 13: Format and lint**

  ```bash
  just format && just lint
  ```
  Expected: no errors.

- [x] **Step 14: Commit**

  ```bash
  git add backend/src/db/entities/vehicle.entity.ts \
          backend/src/modules/vehicle/services/vehicle.service.ts \
          backend/src/modules/vehicle/services/vehicle.service.spec.ts \
          backend/src/modules/vehicle/vehicle.module.ts \
          backend/src/modules/maintenance-card/services/maintenance-card.service.ts \
          backend/src/modules/maintenance-card/services/maintenance-card.service.spec.ts \
          backend/src/modules/maintenance-card/maintenance-card.module.ts
  git commit -m "break circular dependency: cascade soft-delete via TypeORM OneToMany relation"
  ```

---

## Task 2: Controller Fixes — HTTP 201 and Date Double-Wrap

**Files:**
- Modify: `backend/src/modules/maintenance-card/controllers/maintenance-card.controller.ts`
- Modify: `backend/src/modules/maintenance-card/controllers/maintenance-card.controller.spec.ts`

---

- [x] **Step 1: Check existing controller spec for POST test coverage**

  Read `backend/src/modules/maintenance-card/controllers/maintenance-card.controller.spec.ts` to understand what POST tests already exist and whether 201 is asserted.

- [x] **Step 2: Check how the controller spec tests are structured**

  Read the controller spec. If it calls `controller.create(...)` directly (without spinning up the NestJS HTTP server), **`@HttpCode` decorators do not fire** — the status code is only applied by the NestJS HTTP pipeline. In that case:
  - Do NOT add a 201 assertion in the unit spec (it will always see `undefined`, not 201).
  - The 201 status is validated at the API integration-test level (`api-test/`).
  - Simply verify the unit spec has a test that calls `controller.create(...)` and checks the returned DTO shape (not the status code).

  Skip the "verify it fails" step (Step 3 below) if no status-code assertion is being added.

- [x] **Step 3: Run the controller spec — verify the new test fails**

  ```bash
  cd backend && pnpm exec vitest run src/modules/maintenance-card/controllers/maintenance-card.controller.spec.ts
  ```
  Skipped — direct controller calls bypass `@HttpCode`, no status assertion added to unit spec.

- [x] **Step 4: Fix the controller**

  In `backend/src/modules/maintenance-card/controllers/maintenance-card.controller.ts`:

  1. Add `HttpStatus` to the `@nestjs/common` import.
  2. Add `@HttpCode(HttpStatus.CREATED)` decorator to the `create` method — place it between `@Post()` and `async create(...)`.
  3. Fix the date double-wrap in `toResDTO` — change:
     ```typescript
     nextDueDate: card.nextDueDate ? new Date(card.nextDueDate).toISOString() : null,
     ```
     to:
     ```typescript
     nextDueDate: card.nextDueDate ? card.nextDueDate.toISOString() : null,
     ```

- [x] **Step 5: Run the controller spec — all tests pass**

  ```bash
  cd backend && pnpm exec vitest run src/modules/maintenance-card/controllers/maintenance-card.controller.spec.ts
  ```
  Expected: all tests PASS.

- [x] **Step 6: Format and lint**

  ```bash
  just format && just lint
  ```

- [x] **Step 7: Commit**

  ```bash
  git add backend/src/modules/maintenance-card/controllers/maintenance-card.controller.ts \
          backend/src/modules/maintenance-card/controllers/maintenance-card.controller.spec.ts
  git commit -m "fix: POST 201 status on maintenance card create, drop redundant date constructor"
  ```

---

## Task 3: Remove Redundant `!isOverdue(c)` in `sortByUrgency`

**Files:**
- Modify: `backend/src/modules/maintenance-card/services/maintenance-card.service.ts`

No new tests needed — existing `sortByUrgency` tests already cover the `noDueInfo` bucket.

---

- [x] **Step 1: Run existing service spec — confirm it passes before the change**

  ```bash
  cd backend && pnpm exec vitest run src/modules/maintenance-card/services/maintenance-card.service.spec.ts
  ```
  Expected: PASS.

- [x] **Step 2: Remove the redundant check**

  In `backend/src/modules/maintenance-card/services/maintenance-card.service.ts`, change the `noDueInfo` filter from:

  ```typescript
  const noDueInfo = cards.filter(
    (c) => !isOverdue(c) && c.nextDueDate === null && c.nextDueMileage === null,
  );
  ```

  to:

  ```typescript
  const noDueInfo = cards.filter(
    (c) => c.nextDueDate === null && c.nextDueMileage === null,
  );
  ```

  Note: implemented as a single-pass `for` loop (classifying each card into one of four buckets), which eliminates the redundant checks altogether.

- [x] **Step 3: Run the spec again — all tests still pass**

  ```bash
  cd backend && pnpm exec vitest run src/modules/maintenance-card/services/maintenance-card.service.spec.ts
  ```
  Expected: PASS.

- [x] **Step 4: Commit**

  ```bash
  git add backend/src/modules/maintenance-card/services/maintenance-card.service.ts
  git commit -m "remove redundant isOverdue guard in noDueInfo filter"
  ```

---

## Task 4: Fix `intervalMileage` Column Type — `decimal` → `int`

`intervalMileage` represents a whole-number mileage interval (e.g. 5000 km). The current `decimal(10,2)` is incorrect; `int` is the right type. This requires an entity change and a database migration.

**Files:**
- Modify: `backend/src/db/entities/maintenance-card.entity.ts`
- Create: `backend/src/db/migrations/<timestamp>-FixIntervalMileageType.ts` (generated)

---

- [x] **Step 1: Update the entity**

  In `backend/src/db/entities/maintenance-card.entity.ts`, change the `intervalMileage` column definition from:

  ```typescript
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    name: 'interval_mileage',
    transformer: decimalTransformer,
  })
  intervalMileage: number | null;
  ```

  to:

  ```typescript
  @Column({ type: 'int', nullable: true, name: 'interval_mileage' })
  intervalMileage: number | null;
  ```

  Note: remove the `transformer: decimalTransformer` — it is only needed for `decimal` columns (it converts the string that Postgres returns for `decimal` columns to a JS `number`). `int` columns are returned as JS numbers directly.

- [x] **Step 2: Generate the migration**

  Ensure Docker services are running (`just up`), then:

  ```bash
  cd backend && pnpm run migration:generate --name=FixIntervalMileageType
  ```

  Expected: a new migration file created under `src/db/migrations/`.

- [x] **Step 3: Review the generated migration**

  Open the generated migration file. Verify it contains:
  - An `ALTER COLUMN interval_mileage TYPE integer` (or equivalent) in `up()`
  - The reverse operation in `down()`

  The migration should look roughly like:

  ```typescript
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "maintenance_cards" ALTER COLUMN "interval_mileage" TYPE integer USING "interval_mileage"::integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "maintenance_cards" ALTER COLUMN "interval_mileage" TYPE numeric(10,2) USING "interval_mileage"::numeric`,
    );
  }
  ```

  If it looks correct, proceed. If TypeORM generated something unexpected, correct it manually.

- [x] **Step 4: Run the migration**

  ```bash
  cd backend && pnpm run migration:run
  ```
  Expected: migration runs successfully with no errors.

- [x] **Step 5: Run all unit tests — no failures**

  ```bash
  cd backend && pnpm exec vitest run
  ```
  Expected: all tests PASS.

- [x] **Step 6: Format and lint**

  ```bash
  just format && just lint
  ```

- [x] **Step 7: Commit**

  ```bash
  git add backend/src/db/entities/maintenance-card.entity.ts \
          backend/src/db/migrations/
  git commit -m "fix: change intervalMileage column type from decimal to int"
  ```

---

## Final Verification

- [x] **Run the full test suite**

  ```bash
  just test-unit
  ```
  Result: 74/74 tests pass (13 test files).

- [x] **Check no `forwardRef` remains in vehicle or maintenance-card modules**

  ```bash
  grep -r "forwardRef" backend/src/modules/vehicle backend/src/modules/maintenance-card
  ```
  Result: no output — clean.
