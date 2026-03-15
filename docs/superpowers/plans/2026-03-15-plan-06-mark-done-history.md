# Plan 06: Mark Maintenance Done & Maintenance History

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement "Mark Maintenance Done" (`POST .../complete`) and "Maintenance History" (`GET .../history`) features. Mark-done creates a `MaintenanceHistory` record, optionally auto-updates vehicle mileage, and recomputes `nextDueMileage` / `nextDueDate` on the card. The history endpoint returns all history records for a card, even when the card is soft-deleted.

**Architecture:** `MaintenanceHistoryRepository` and `MaintenanceHistoryService` live in the `maintenance-card` module (same bounded context). `MaintenanceCardService.markDone` orchestrates the flow: validate card, create history, conditionally update vehicle mileage, reset card due fields. `MaintenanceCardController` gains two new routes. `MaintenanceCardModule` is updated to register the new entity and providers.

**Tech Stack:** NestJS, TypeORM (`MaintenanceHistoryEntity`, `MaintenanceCardEntity`, `VehicleEntity`), class-validator, `@project/types`

**Spec reference:** `docs/superpowers/specs/2026-03-14-maintenance-tracker-design.md` — Section 3 (MaintenanceHistory data model), Section 4 (Mark Done API, History API), Section 7 (Soft delete: history survives card delete)

**Prerequisites:** Plans 01–05 must be complete.

---

## Chunk 1: Shared Types

### Task 1: Add Maintenance History DTOs to `@project/types`

**Files:**
- Create: `packages/types/src/dtos/maintenance-history.dto.ts`
- Modify: `packages/types/src/dtos/index.ts`

- [ ] **Step 1: Create `maintenance-history.dto.ts`**

Create `packages/types/src/dtos/maintenance-history.dto.ts`:

```typescript
export interface IMarkDoneReqDTO {
  doneAtMileage?: number | null;
  notes?: string | null;
}

export interface IMaintenanceHistoryResDTO {
  id: string;
  maintenanceCardId: string;
  doneAtMileage: number | null;
  doneAtDate: string;
  notes: string | null;
  createdAt: string;
}
```

- [ ] **Step 2: Re-export from `packages/types/src/dtos/index.ts`**

Add to `packages/types/src/dtos/index.ts`:

```typescript
export * from './maintenance-history.dto';
```

- [ ] **Step 3: Build `@project/types`**

```bash
cd packages/types && pnpm run build
```

Expected: No TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add packages/types/src/dtos/maintenance-history.dto.ts packages/types/src/dtos/index.ts
git commit -m "feat: add MaintenanceHistory DTOs to shared types"
```

---

## Chunk 2: MaintenanceHistoryRepository

### Task 2: Create `MaintenanceHistoryRepository`

**Files:**
- Create: `backend/src/modules/maintenance-card/repositories/maintenance-history.repository.ts`
- Create: `backend/src/modules/maintenance-card/repositories/maintenance-history.repository.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/modules/maintenance-card/repositories/maintenance-history.repository.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MaintenanceHistoryRepository } from './maintenance-history.repository';
import { MaintenanceHistoryEntity } from 'src/db/entities/maintenance-history.entity';

const mockTypeOrmRepo = {
  create: vi.fn(),
  save: vi.fn(),
  find: vi.fn(),
};

describe('MaintenanceHistoryRepository', () => {
  let repository: MaintenanceHistoryRepository;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceHistoryRepository,
        {
          provide: getRepositoryToken(MaintenanceHistoryEntity),
          useValue: mockTypeOrmRepo,
        },
      ],
    }).compile();

    repository = module.get<MaintenanceHistoryRepository>(MaintenanceHistoryRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('#create', () => {
    it('creates and saves a new history record', async () => {
      const doneAt = new Date('2026-03-15');
      const newHistory = {
        id: 'history-1',
        maintenanceCardId: 'card-1',
        doneAtMileage: 12500,
        doneAtDate: doneAt,
        notes: null,
        createdAt: new Date(),
      } as MaintenanceHistoryEntity;

      mockTypeOrmRepo.create.mockReturnValue(newHistory);
      mockTypeOrmRepo.save.mockResolvedValue(newHistory);

      const result = await repository.create({
        creationData: {
          maintenanceCardId: 'card-1',
          doneAtMileage: 12500,
          doneAtDate: doneAt,
          notes: null,
        },
      });

      expect(mockTypeOrmRepo.create).toHaveBeenCalledWith({
        maintenanceCardId: 'card-1',
        doneAtMileage: 12500,
        doneAtDate: doneAt,
        notes: null,
      });
      expect(result).toEqual(newHistory);
    });
  });

  describe('#findByCardId', () => {
    it('returns history records ordered by doneAtDate DESC', async () => {
      const records = [
        { id: 'h-2', maintenanceCardId: 'card-1', doneAtDate: new Date('2026-03-15') },
        { id: 'h-1', maintenanceCardId: 'card-1', doneAtDate: new Date('2026-01-01') },
      ] as MaintenanceHistoryEntity[];

      mockTypeOrmRepo.find.mockResolvedValue(records);

      const result = await repository.findByCardId('card-1');

      expect(mockTypeOrmRepo.find).toHaveBeenCalledWith({
        where: { maintenanceCardId: 'card-1' },
        order: { doneAtDate: 'DESC' },
      });
      expect(result).toEqual(records);
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend && pnpm exec vitest run src/modules/maintenance-card/repositories/maintenance-history.repository.spec.ts
```

Expected: FAIL — `MaintenanceHistoryRepository` not found.

- [ ] **Step 3: Create `MaintenanceHistoryRepository`**

Create `backend/src/modules/maintenance-card/repositories/maintenance-history.repository.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { MaintenanceHistoryEntity } from 'src/db/entities/maintenance-history.entity';
import { BaseDBUtil } from 'src/modules/common/base-classes/base-db-util';

export type CreateHistoryData = {
  maintenanceCardId: string;
  doneAtMileage: number | null;
  doneAtDate: Date;
  notes: string | null;
};

@Injectable()
export class MaintenanceHistoryRepository extends BaseDBUtil<
  MaintenanceHistoryEntity,
  CreateHistoryData
> {
  constructor(
    @InjectRepository(MaintenanceHistoryEntity)
    private readonly historyRepo: Repository<MaintenanceHistoryEntity>,
  ) {
    super(MaintenanceHistoryEntity, historyRepo);
  }

  async create(params: {
    creationData: CreateHistoryData;
    entityManager?: EntityManager;
  }): Promise<MaintenanceHistoryEntity> {
    const { creationData, entityManager } = params;
    const repo =
      (entityManager?.getRepository(
        MaintenanceHistoryEntity,
      ) as Repository<MaintenanceHistoryEntity>) ?? this.historyRepo;

    const record = repo.create(creationData);
    return await repo.save(record);
  }

  async findByCardId(maintenanceCardId: string): Promise<MaintenanceHistoryEntity[]> {
    return this.historyRepo.find({
      where: { maintenanceCardId },
      order: { doneAtDate: 'DESC' },
    });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd backend && pnpm exec vitest run src/modules/maintenance-card/repositories/maintenance-history.repository.spec.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/maintenance-card/repositories/maintenance-history.repository.ts \
        backend/src/modules/maintenance-card/repositories/maintenance-history.repository.spec.ts
git commit -m "feat: add MaintenanceHistoryRepository"
```

---

## Chunk 3: `getOneWithDeleted` on `MaintenanceCardRepository`

### Task 3: Add `getOneWithDeleted` to `MaintenanceCardRepository`

**Files:**
- Modify: `backend/src/modules/maintenance-card/repositories/maintenance-card.repository.ts`
- Modify: `backend/src/modules/maintenance-card/repositories/maintenance-card.repository.spec.ts`

- [ ] **Step 1: Add the failing test**

In `backend/src/modules/maintenance-card/repositories/maintenance-card.repository.spec.ts`, add `findOne: vi.fn()` to the `mockTypeOrmRepo` object at the top:

```typescript
const mockTypeOrmRepo = {
  create: vi.fn(),
  save: vi.fn(),
  findOne: vi.fn(),
};
```

Add the following describe block inside `describe('MaintenanceCardRepository', ...)`:

```typescript
describe('#getOneWithDeleted', () => {
  it('calls findOne with withDeleted: true', async () => {
    const card = { id: 'card-1', vehicleId: 'vehicle-1' };
    mockTypeOrmRepo.findOne.mockResolvedValue(card);

    const result = await repository.getOneWithDeleted({ id: 'card-1', vehicleId: 'vehicle-1' });

    expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'card-1', vehicleId: 'vehicle-1' },
      withDeleted: true,
    });
    expect(result).toEqual(card);
  });

  it('returns null when card not found', async () => {
    mockTypeOrmRepo.findOne.mockResolvedValue(null);

    const result = await repository.getOneWithDeleted({ id: 'card-1', vehicleId: 'vehicle-1' });

    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend && pnpm exec vitest run src/modules/maintenance-card/repositories/maintenance-card.repository.spec.ts
```

Expected: FAIL — `getOneWithDeleted` method not found.

- [ ] **Step 3: Add `getOneWithDeleted` to `MaintenanceCardRepository`**

In `backend/src/modules/maintenance-card/repositories/maintenance-card.repository.ts`, add the following method to the `MaintenanceCardRepository` class after the existing `create` method:

```typescript
async getOneWithDeleted(criteria: {
  id: string;
  vehicleId: string;
}): Promise<MaintenanceCardEntity | null> {
  return this.cardRepo.findOne({
    where: { id: criteria.id, vehicleId: criteria.vehicleId },
    withDeleted: true,
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd backend && pnpm exec vitest run src/modules/maintenance-card/repositories/maintenance-card.repository.spec.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/maintenance-card/repositories/maintenance-card.repository.ts \
        backend/src/modules/maintenance-card/repositories/maintenance-card.repository.spec.ts
git commit -m "feat: add getOneWithDeleted to MaintenanceCardRepository"
```

---

## Chunk 4: `markDone` on `MaintenanceCardService`

### Task 4: Add `markDone` to `MaintenanceCardService`

**Files:**
- Modify: `backend/src/modules/maintenance-card/services/maintenance-card.service.ts`
- Modify: `backend/src/modules/maintenance-card/services/maintenance-card.service.spec.ts`

- [ ] **Step 1: Add failing tests**

In `backend/src/modules/maintenance-card/services/maintenance-card.service.spec.ts`:

Add to the import block at the top:

```typescript
import { BadRequestException } from '@nestjs/common';
import { MaintenanceHistoryRepository } from '../repositories/maintenance-history.repository';
import { MaintenanceHistoryEntity } from 'src/db/entities/maintenance-history.entity';
```

Add to the mock declarations block:

```typescript
const mockHistoryRepository = {
  create: vi.fn(),
  findByCardId: vi.fn(),
};
```

Add `updateVehicle: vi.fn()` to the existing `mockVehicleService` object.

Add `MaintenanceHistoryRepository` to the `TestingModule` providers inside `beforeEach`:

```typescript
{ provide: MaintenanceHistoryRepository, useValue: mockHistoryRepository },
```

Add a `baseHistory` constant after the existing `baseCard` constant:

```typescript
const baseHistory = {
  id: 'history-1',
  maintenanceCardId: cardId,
  doneAtMileage: 12500,
  doneAtDate: new Date('2026-03-15'),
  notes: null,
  createdAt: new Date(),
} as MaintenanceHistoryEntity;
```

Add the following describe block inside `describe('MaintenanceCardService', ...)`:

```typescript
describe('#markDone', () => {
  beforeEach(() => {
    mockMaintenanceCardRepository.getOne.mockResolvedValue({
      ...baseCard,
      intervalMileage: 6000,
      intervalTimeMonths: 6,
      nextDueMileage: null,
      nextDueDate: null,
    });
    mockHistoryRepository.create.mockResolvedValue(baseHistory);
    mockMaintenanceCardRepository.updateWithSave.mockImplementation(({ dataArray }) =>
      Promise.resolve(dataArray),
    );
    mockVehicleService.updateVehicle.mockResolvedValue({ ...baseVehicle, mileage: 12500 });
  });

  it('creates a history record with server-side today as doneAtDate', async () => {
    const before = new Date();
    await service.markDone(cardId, vehicleId, userId, { doneAtMileage: 12500 });
    const after = new Date();

    const call = mockHistoryRepository.create.mock.calls[0][0];
    expect(call.creationData.maintenanceCardId).toBe(cardId);
    expect(call.creationData.doneAtMileage).toBe(12500);
    expect(call.creationData.doneAtDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(call.creationData.doneAtDate.getTime()).toBeLessThanOrEqual(after.getTime());
    expect(call.creationData.notes).toBeNull();
  });

  it('resets nextDueMileage when intervalMileage is set', async () => {
    await service.markDone(cardId, vehicleId, userId, { doneAtMileage: 12500 });

    const savedCard = mockMaintenanceCardRepository.updateWithSave.mock.calls[0][0].dataArray[0];
    expect(savedCard.nextDueMileage).toBe(18500); // 12500 + 6000
  });

  it('resets nextDueDate when intervalTimeMonths is set', async () => {
    await service.markDone(cardId, vehicleId, userId, { doneAtMileage: 12500 });

    const savedCard = mockMaintenanceCardRepository.updateWithSave.mock.calls[0][0].dataArray[0];
    expect(savedCard.nextDueDate).toBeDefined();
    expect(savedCard.nextDueDate).not.toBeNull();
  });

  it('auto-updates vehicle mileage when doneAtMileage > vehicle.mileage', async () => {
    await service.markDone(cardId, vehicleId, userId, { doneAtMileage: 12500 });

    expect(mockVehicleService.updateVehicle).toHaveBeenCalledWith(vehicleId, userId, {
      mileage: 12500,
    });
  });

  it('does NOT update vehicle mileage when doneAtMileage <= vehicle.mileage', async () => {
    await service.markDone(cardId, vehicleId, userId, { doneAtMileage: 9000 });

    expect(mockVehicleService.updateVehicle).not.toHaveBeenCalled();
  });

  it('uses vehicle.mileage for nextDueMileage when doneAtMileage is not provided', async () => {
    mockMaintenanceCardRepository.getOne.mockResolvedValue({
      ...baseCard,
      intervalMileage: 6000,
      intervalTimeMonths: null,
      nextDueMileage: null,
      nextDueDate: null,
    });

    await service.markDone(cardId, vehicleId, userId, {});

    const savedCard = mockMaintenanceCardRepository.updateWithSave.mock.calls[0][0].dataArray[0];
    expect(savedCard.nextDueMileage).toBe(16000); // 10000 (vehicle.mileage) + 6000
  });

  it('throws BadRequestException when card has intervalMileage but doneAtMileage is not provided', async () => {
    await expect(
      service.markDone(cardId, vehicleId, userId, {}),
    ).rejects.toThrow(BadRequestException);
  });

  it('passes notes through to the history record', async () => {
    await service.markDone(cardId, vehicleId, userId, {
      doneAtMileage: 12500,
      notes: 'replaced oil filter too',
    });

    const call = mockHistoryRepository.create.mock.calls[0][0];
    expect(call.creationData.notes).toBe('replaced oil filter too');
  });

  it('returns the created history record', async () => {
    const result = await service.markDone(cardId, vehicleId, userId, { doneAtMileage: 12500 });
    expect(result).toEqual(baseHistory);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend && pnpm exec vitest run src/modules/maintenance-card/services/maintenance-card.service.spec.ts
```

Expected: FAIL — `markDone` not found, provider mismatch.

- [ ] **Step 3: Update `MaintenanceCardService`**

In `backend/src/modules/maintenance-card/services/maintenance-card.service.ts`:

Update the `@nestjs/common` import in the file to include `BadRequestException` (add it to the existing import line). Then add the new repository/entity imports:

```typescript
import { MaintenanceHistoryRepository } from '../repositories/maintenance-history.repository';
import { MaintenanceHistoryEntity } from 'src/db/entities/maintenance-history.entity';
```

Add `MarkDoneInput` type after the existing type declarations:

```typescript
export type MarkDoneInput = {
  doneAtMileage?: number | null;
  notes?: string | null;
};
```

Update the constructor to inject `MaintenanceHistoryRepository`:

```typescript
constructor(
  private readonly cardRepository: MaintenanceCardRepository,
  private readonly historyRepository: MaintenanceHistoryRepository,
  @Inject(forwardRef(() => VehicleService))
  private readonly vehicleService: VehicleService,
) {}
```

Add the `markDone` method after `deleteCardsByVehicleId`:

```typescript
async markDone(
  id: string,
  vehicleId: string,
  userId: string,
  input: MarkDoneInput,
): Promise<MaintenanceHistoryEntity> {
  const vehicle = await this.vehicleService.getVehicle(vehicleId, userId);
  const card = await this.getCard(id, vehicleId, userId);

  if (card.intervalMileage !== null && input.doneAtMileage == null) {
    throw new BadRequestException(
      'doneAtMileage is required when the card has an intervalMileage',
    );
  }

  const today = new Date();

  if (input.doneAtMileage != null && input.doneAtMileage > vehicle.mileage) {
    await this.vehicleService.updateVehicle(vehicleId, userId, {
      mileage: input.doneAtMileage,
    });
  }

  const mileageForReset =
    input.doneAtMileage != null ? input.doneAtMileage : vehicle.mileage;

  if (card.intervalMileage !== null) {
    card.nextDueMileage = mileageForReset + card.intervalMileage;
  }

  if (card.intervalTimeMonths !== null) {
    const nextDue = new Date(today);
    nextDue.setMonth(nextDue.getMonth() + card.intervalTimeMonths);
    card.nextDueDate = nextDue;
  }

  await this.cardRepository.updateWithSave({ dataArray: [card] });

  // TODO: BackgroundJob cancellation (pending/processing jobs for this card) deferred to Plan 08 (Background Job Infrastructure)

  return this.historyRepository.create({
    creationData: {
      maintenanceCardId: id,
      doneAtMileage: input.doneAtMileage ?? null,
      doneAtDate: today,
      notes: input.notes ?? null,
    },
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd backend && pnpm exec vitest run src/modules/maintenance-card/services/maintenance-card.service.spec.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/maintenance-card/services/maintenance-card.service.ts \
        backend/src/modules/maintenance-card/services/maintenance-card.service.spec.ts
git commit -m "feat: add markDone to MaintenanceCardService"
```

---

## Chunk 5: `MaintenanceHistoryService`

### Task 5: Create `MaintenanceHistoryService`

**Files:**
- Create: `backend/src/modules/maintenance-card/services/maintenance-history.service.ts`
- Create: `backend/src/modules/maintenance-card/services/maintenance-history.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/modules/maintenance-card/services/maintenance-history.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MaintenanceHistoryService } from './maintenance-history.service';
import { MaintenanceHistoryRepository } from '../repositories/maintenance-history.repository';
import { MaintenanceCardRepository } from '../repositories/maintenance-card.repository';
import { VehicleService } from 'src/modules/vehicle/services/vehicle.service';
import { MaintenanceCardType } from 'src/db/entities/maintenance-card.entity';
import { MileageUnit } from 'src/db/entities/vehicle.entity';

const mockHistoryRepository = {
  findByCardId: vi.fn(),
};

const mockCardRepository = {
  getOneWithDeleted: vi.fn(),
};

const mockVehicleService = {
  getVehicle: vi.fn(),
};

const userId = 'user-1';
const vehicleId = 'vehicle-1';
const cardId = 'card-1';

const baseVehicle = {
  id: vehicleId,
  userId,
  mileage: 10000,
  mileageUnit: MileageUnit.KM,
};

const baseCard = {
  id: cardId,
  vehicleId,
  type: MaintenanceCardType.TASK,
  name: 'CVT Cleaning',
  description: null,
  intervalMileage: 6000,
  intervalTimeMonths: 6,
  nextDueMileage: null,
  nextDueDate: null,
  deletedAt: null,
};

const baseHistory = [
  {
    id: 'history-2',
    maintenanceCardId: cardId,
    doneAtMileage: 12500,
    doneAtDate: new Date('2026-03-15'),
    notes: null,
    createdAt: new Date(),
  },
  {
    id: 'history-1',
    maintenanceCardId: cardId,
    doneAtMileage: 6000,
    doneAtDate: new Date('2026-01-01'),
    notes: null,
    createdAt: new Date(),
  },
];

describe('MaintenanceHistoryService', () => {
  let service: MaintenanceHistoryService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceHistoryService,
        { provide: MaintenanceHistoryRepository, useValue: mockHistoryRepository },
        { provide: MaintenanceCardRepository, useValue: mockCardRepository },
        { provide: VehicleService, useValue: mockVehicleService },
      ],
    }).compile();

    service = module.get<MaintenanceHistoryService>(MaintenanceHistoryService);
  });

  describe('#listHistory', () => {
    it('verifies vehicle ownership before fetching history', async () => {
      mockVehicleService.getVehicle.mockResolvedValue(baseVehicle);
      mockCardRepository.getOneWithDeleted.mockResolvedValue(baseCard);
      mockHistoryRepository.findByCardId.mockResolvedValue(baseHistory);

      await service.listHistory(cardId, vehicleId, userId);

      expect(mockVehicleService.getVehicle).toHaveBeenCalledWith(vehicleId, userId);
    });

    it('fetches card using getOneWithDeleted to support soft-deleted cards', async () => {
      mockVehicleService.getVehicle.mockResolvedValue(baseVehicle);
      mockCardRepository.getOneWithDeleted.mockResolvedValue(baseCard);
      mockHistoryRepository.findByCardId.mockResolvedValue(baseHistory);

      await service.listHistory(cardId, vehicleId, userId);

      expect(mockCardRepository.getOneWithDeleted).toHaveBeenCalledWith({
        id: cardId,
        vehicleId,
      });
    });

    it('throws NotFoundException when card does not exist (even with deleted check)', async () => {
      mockVehicleService.getVehicle.mockResolvedValue(baseVehicle);
      mockCardRepository.getOneWithDeleted.mockResolvedValue(null);

      await expect(
        service.listHistory(cardId, vehicleId, userId),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns history records ordered by doneAtDate DESC', async () => {
      mockVehicleService.getVehicle.mockResolvedValue(baseVehicle);
      mockCardRepository.getOneWithDeleted.mockResolvedValue(baseCard);
      mockHistoryRepository.findByCardId.mockResolvedValue(baseHistory);

      const result = await service.listHistory(cardId, vehicleId, userId);

      expect(result).toEqual(baseHistory);
      expect(mockHistoryRepository.findByCardId).toHaveBeenCalledWith(cardId);
    });

    it('throws NotFoundException (via getVehicle) when vehicle does not belong to user', async () => {
      mockVehicleService.getVehicle.mockRejectedValue(new NotFoundException());

      await expect(
        service.listHistory(cardId, vehicleId, userId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend && pnpm exec vitest run src/modules/maintenance-card/services/maintenance-history.service.spec.ts
```

Expected: FAIL — `MaintenanceHistoryService` not found.

- [ ] **Step 3: Create `MaintenanceHistoryService`**

Create `backend/src/modules/maintenance-card/services/maintenance-history.service.ts`:

```typescript
import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MaintenanceHistoryEntity } from 'src/db/entities/maintenance-history.entity';
import { VehicleService } from 'src/modules/vehicle/services/vehicle.service';
import { MaintenanceCardRepository } from '../repositories/maintenance-card.repository';
import { MaintenanceHistoryRepository } from '../repositories/maintenance-history.repository';

@Injectable()
export class MaintenanceHistoryService {
  constructor(
    private readonly historyRepository: MaintenanceHistoryRepository,
    private readonly cardRepository: MaintenanceCardRepository,
    @Inject(forwardRef(() => VehicleService))
    private readonly vehicleService: VehicleService,
  ) {}

  async listHistory(
    cardId: string,
    vehicleId: string,
    userId: string,
  ): Promise<MaintenanceHistoryEntity[]> {
    await this.vehicleService.getVehicle(vehicleId, userId);

    const card = await this.cardRepository.getOneWithDeleted({ id: cardId, vehicleId });
    if (!card) throw new NotFoundException('Maintenance card not found');

    return this.historyRepository.findByCardId(cardId);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd backend && pnpm exec vitest run src/modules/maintenance-card/services/maintenance-history.service.spec.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/maintenance-card/services/maintenance-history.service.ts \
        backend/src/modules/maintenance-card/services/maintenance-history.service.spec.ts
git commit -m "feat: add MaintenanceHistoryService"
```

---

## Chunk 6: Controller Routes

### Task 6: Add `complete` and `history` routes to `MaintenanceCardController`

**Files:**
- Create: `backend/src/modules/maintenance-card/dtos/complete.dto.ts`
- Modify: `backend/src/modules/maintenance-card/controllers/maintenance-card.controller.ts`
- Modify: `backend/src/modules/maintenance-card/controllers/maintenance-card.controller.spec.ts`

- [ ] **Step 1: Create `mark-done.dto.ts`**

Create `backend/src/modules/maintenance-card/dtos/complete.dto.ts`:

```typescript
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { IMarkDoneReqDTO } from '@project/types';

export class MarkDoneDto implements IMarkDoneReqDTO {
  @IsOptional()
  @IsNumber()
  @Min(1)
  doneAtMileage?: number | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}
```

- [ ] **Step 2: Add failing tests for the two new routes**

In `backend/src/modules/maintenance-card/controllers/maintenance-card.controller.spec.ts`:

Add to the import block at the top:

```typescript
import { MaintenanceHistoryService } from '../services/maintenance-history.service';
```

Add to mock service declarations:

```typescript
const mockMaintenanceHistoryService = {
  listHistory: vi.fn(),
};
```

Add `markDone: vi.fn()` to the existing `mockMaintenanceCardService` object.

Add `MaintenanceHistoryService` to the `TestingModule` providers:

```typescript
{ provide: MaintenanceHistoryService, useValue: mockMaintenanceHistoryService },
```

Add a `baseHistory` constant after `baseCard`:

```typescript
const baseHistory = {
  id: 'history-1',
  maintenanceCardId: 'card-1',
  doneAtMileage: 12500,
  doneAtDate: new Date('2026-03-15'),
  notes: null,
  createdAt: new Date(),
};
```

Add the following test cases inside `describe('MaintenanceCardController', ...)`:

```typescript
it('POST /vehicles/:vehicleId/maintenance-cards/:id/complete returns 201 with history DTO', async () => {
  mockMaintenanceCardService.markDone.mockResolvedValue(baseHistory);

  const result = await controller.markDone(
    'vehicle-1',
    'card-1',
    { doneAtMileage: 12500, notes: null },
    authUser,
  );

  expect(mockMaintenanceCardService.markDone).toHaveBeenCalledWith(
    'card-1',
    'vehicle-1',
    authUser.id,
    { doneAtMileage: 12500, notes: null },
  );
  expect(result.id).toBe('history-1');
  expect(typeof result.doneAtDate).toBe('string');
  expect(typeof result.createdAt).toBe('string');
});

it('GET /vehicles/:vehicleId/maintenance-cards/:id/history returns history list', async () => {
  mockMaintenanceHistoryService.listHistory.mockResolvedValue([baseHistory]);

  const result = await controller.listHistory('vehicle-1', 'card-1', authUser);

  expect(mockMaintenanceHistoryService.listHistory).toHaveBeenCalledWith(
    'card-1',
    'vehicle-1',
    authUser.id,
  );
  expect(result).toHaveLength(1);
  expect(typeof result[0].doneAtDate).toBe('string');
  expect(typeof result[0].createdAt).toBe('string');
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd backend && pnpm exec vitest run src/modules/maintenance-card/controllers/maintenance-card.controller.spec.ts
```

Expected: FAIL — `markDone` and `listHistory` methods not found on controller.

- [ ] **Step 4: Update `MaintenanceCardController`**

In `backend/src/modules/maintenance-card/controllers/maintenance-card.controller.ts`:

Add to the import block:

```typescript
import { IMaintenanceHistoryResDTO } from '@project/types';
import { MaintenanceHistoryEntity } from 'src/db/entities/maintenance-history.entity';
import { MaintenanceHistoryService } from '../services/maintenance-history.service';
import { MarkDoneDto } from '../dtos/complete.dto';
```

Add `historyToResDTO` helper after the existing `toResDTO` function:

```typescript
function historyToResDTO(history: MaintenanceHistoryEntity): IMaintenanceHistoryResDTO {
  return {
    id: history.id,
    maintenanceCardId: history.maintenanceCardId,
    doneAtMileage: history.doneAtMileage,
    doneAtDate: new Date(history.doneAtDate).toISOString(),
    notes: history.notes,
    createdAt: history.createdAt.toISOString(),
  };
}
```

Update the constructor to inject `MaintenanceHistoryService`:

```typescript
constructor(
  private readonly cardService: MaintenanceCardService,
  private readonly historyService: MaintenanceHistoryService,
) {}
```

Add the two new route methods after the `delete` method:

```typescript
@Post(':id/complete')
@HttpCode(HttpStatus.CREATED)
async markDone(
  @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
  @Param('id', ParseUUIDPipe) id: string,
  @Body() dto: MarkDoneDto,
  @CurrentUser() user: IAuthUser,
): Promise<IMaintenanceHistoryResDTO> {
  const history = await this.cardService.markDone(id, vehicleId, user.id, {
    doneAtMileage: dto.doneAtMileage ?? null,
    notes: dto.notes ?? null,
  });
  return historyToResDTO(history);
}

@Get(':id/history')
async listHistory(
  @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
  @Param('id', ParseUUIDPipe) id: string,
  @CurrentUser() user: IAuthUser,
): Promise<IMaintenanceHistoryResDTO[]> {
  const records = await this.historyService.listHistory(id, vehicleId, user.id);
  return records.map(historyToResDTO);
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd backend && pnpm exec vitest run src/modules/maintenance-card/controllers/maintenance-card.controller.spec.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/maintenance-card/dtos/complete.dto.ts \
        backend/src/modules/maintenance-card/controllers/maintenance-card.controller.ts \
        backend/src/modules/maintenance-card/controllers/maintenance-card.controller.spec.ts
git commit -m "feat: add complete and history routes to MaintenanceCardController"
```

---

## Chunk 7: Module Registration

### Task 7: Update `MaintenanceCardModule` to register new providers and entity

**Files:**
- Modify: `backend/src/modules/maintenance-card/maintenance-card.module.ts`

- [ ] **Step 1: Update `MaintenanceCardModule`**

Replace the content of `backend/src/modules/maintenance-card/maintenance-card.module.ts` with:

```typescript
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaintenanceCardEntity } from 'src/db/entities/maintenance-card.entity';
import { MaintenanceHistoryEntity } from 'src/db/entities/maintenance-history.entity';
import { VehicleModule } from '../vehicle/vehicle.module';
import { MaintenanceCardRepository } from './repositories/maintenance-card.repository';
import { MaintenanceHistoryRepository } from './repositories/maintenance-history.repository';
import { MaintenanceCardService } from './services/maintenance-card.service';
import { MaintenanceHistoryService } from './services/maintenance-history.service';
import { MaintenanceCardController } from './controllers/maintenance-card.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([MaintenanceCardEntity, MaintenanceHistoryEntity]),
    forwardRef(() => VehicleModule),
  ],
  providers: [
    MaintenanceCardRepository,
    MaintenanceHistoryRepository,
    MaintenanceCardService,
    MaintenanceHistoryService,
  ],
  controllers: [MaintenanceCardController],
  exports: [MaintenanceCardService],
})
export class MaintenanceCardModule {}
```

- [ ] **Step 2: Run all unit tests**

```bash
just test-unit
```

Expected: All tests pass.

- [ ] **Step 3: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [ ] **Step 4: Smoke test the API**

Start services (`just up-build`), obtain a Firebase ID token, then run:

```bash
# Create a vehicle
VEHICLE=$(curl -s -X POST http://localhost:3001/vehicles \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"brand":"Honda","model":"PCX","colour":"White","mileage":10000,"mileageUnit":"km"}')
VEHICLE_ID=$(echo $VEHICLE | jq -r '.id')

# Create a maintenance card
CARD=$(curl -s -X POST "http://localhost:3001/vehicles/$VEHICLE_ID/maintenance-cards" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"type":"task","name":"CVT Cleaning","intervalMileage":6000,"intervalTimeMonths":6}')
CARD_ID=$(echo $CARD | jq -r '.id')

# Mark done with mileage higher than vehicle current mileage (should auto-update vehicle)
curl -s -X POST "http://localhost:3001/vehicles/$VEHICLE_ID/maintenance-cards/$CARD_ID/complete" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"doneAtMileage":12500}' | jq

# Verify card nextDue fields were updated
curl -s "http://localhost:3001/vehicles/$VEHICLE_ID/maintenance-cards/$CARD_ID" \
  -H "Authorization: Bearer <token>" | jq '.nextDueMileage, .nextDueDate'
# Expected: nextDueMileage = 18500, nextDueDate = ~6 months from today

# Verify vehicle mileage was auto-updated
curl -s "http://localhost:3001/vehicles/$VEHICLE_ID" \
  -H "Authorization: Bearer <token>" | jq '.mileage'
# Expected: 12500

# Fetch history
curl -s "http://localhost:3001/vehicles/$VEHICLE_ID/maintenance-cards/$CARD_ID/history" \
  -H "Authorization: Bearer <token>" | jq
# Expected: array with one record, doneAtDate = today, doneAtMileage = 12500

# Soft-delete the card, then verify history is still accessible
curl -s -o /dev/null -w "%{http_code}" -X DELETE \
  "http://localhost:3001/vehicles/$VEHICLE_ID/maintenance-cards/$CARD_ID" \
  -H "Authorization: Bearer <token>"
# Expected: 204

curl -s "http://localhost:3001/vehicles/$VEHICLE_ID/maintenance-cards/$CARD_ID/history" \
  -H "Authorization: Bearer <token>" | jq
# Expected: 200 with history records still returned
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/maintenance-card/maintenance-card.module.ts
git commit -m "feat: register MaintenanceHistoryEntity and providers in MaintenanceCardModule"
```
