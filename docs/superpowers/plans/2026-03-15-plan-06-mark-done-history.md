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

- [x] **Step 1: Create `maintenance-history.dto.ts`**

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

- [x] **Step 2: Re-export from `packages/types/src/dtos/index.ts`**

Add to `packages/types/src/dtos/index.ts`:

```typescript
export * from './maintenance-history.dto';
```

- [x] **Step 3: Build `@project/types`**

```bash
cd packages/types && pnpm run build
```

Expected: No TypeScript errors.

- [x] **Step 4: Commit**

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

- [x] **Step 1: Write the failing test**

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

- [x] **Step 2: Run the test to verify it fails**

```bash
cd backend && pnpm exec vitest run src/modules/maintenance-card/repositories/maintenance-history.repository.spec.ts
```

Expected: FAIL — `MaintenanceHistoryRepository` not found.

- [x] **Step 3: Create `MaintenanceHistoryRepository`**

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

- [x] **Step 4: Run the test to verify it passes**

```bash
cd backend && pnpm exec vitest run src/modules/maintenance-card/repositories/maintenance-history.repository.spec.ts
```

Expected: PASS

- [x] **Step 5: Commit**

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

- [x] **Step 1: Add the failing test**

> ⚠️ **Deviation [D1]:** Signature uses positional `(id, vehicleId)` instead of `criteria: { id, vehicleId }` object — see [D1](#d1-getoneWithDeleted-positional-signature).

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

    const result = await repository.getOneWithDeleted('card-1', 'vehicle-1');

    expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'card-1', vehicleId: 'vehicle-1' },
      withDeleted: true,
    });
    expect(result).toEqual(card);
  });

  it('returns null when card not found', async () => {
    mockTypeOrmRepo.findOne.mockResolvedValue(null);

    const result = await repository.getOneWithDeleted('card-1', 'vehicle-1');

    expect(result).toBeNull();
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

```bash
cd backend && pnpm exec vitest run src/modules/maintenance-card/repositories/maintenance-card.repository.spec.ts
```

Expected: FAIL — `getOneWithDeleted` method not found.

- [x] **Step 3: Add `getOneWithDeleted` to `MaintenanceCardRepository`**

In `backend/src/modules/maintenance-card/repositories/maintenance-card.repository.ts`, add the following method after the existing `create` method:

```typescript
async getOneWithDeleted(
  id: string,
  vehicleId: string,
): Promise<MaintenanceCardEntity | null> {
  return this.cardRepo.findOne({
    where: { id, vehicleId },
    withDeleted: true,
  });
}
```

- [x] **Step 4: Run the test to verify it passes**

```bash
cd backend && pnpm exec vitest run src/modules/maintenance-card/repositories/maintenance-card.repository.spec.ts
```

Expected: PASS

- [x] **Step 5: Commit**

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

- [x] **Step 1: Add failing tests**

> ⚠️ **Deviations:** No `forwardRef` [D2]; added `DataSource` transaction [D3]; parallel vehicle+card fetch [D4]; `updateVehicle` after transaction [D5]; removed `mileageForReset` fallback [D6].

In `backend/src/modules/maintenance-card/services/maintenance-card.service.spec.ts`:

Add to the import block at the top:

```typescript
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { MaintenanceHistoryRepository } from '../repositories/maintenance-history.repository';
import { MaintenanceHistoryEntity } from 'src/db/entities/maintenance-history.entity';
```

Add to the mock declarations block:

```typescript
const mockHistoryRepository = {
  create: vi.fn(),
  findByCardId: vi.fn(),
};

const mockEntityManager = {};
const mockDataSource = {
  transaction: vi
    .fn()
    .mockImplementation(async (callback: (em: object) => Promise<unknown>) =>
      callback(mockEntityManager),
    ),
};
```

Add `updateVehicle: vi.fn()` to the existing `mockVehicleService` object.

Add `MaintenanceHistoryRepository` and `DataSource` to the `TestingModule` providers inside `beforeEach`:

```typescript
{ provide: MaintenanceHistoryRepository, useValue: mockHistoryRepository },
{ provide: getDataSourceToken(), useValue: mockDataSource },
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
    mockMaintenanceCardRepository.updateWithSave.mockImplementation(
      ({ dataArray }) => Promise.resolve(dataArray),
    );
    mockVehicleService.updateVehicle.mockResolvedValue({
      ...baseVehicle,
      mileage: 12500,
    });
  });

  it('creates a history record with server-side today as doneAtDate', async () => {
    const before = new Date();
    await service.markDone(cardId, vehicleId, userId, { doneAtMileage: 12500 });
    const after = new Date();

    const call = mockHistoryRepository.create.mock.calls[0]?.[0] as {
      creationData: {
        maintenanceCardId: string;
        doneAtMileage: number;
        doneAtDate: Date;
        notes: string | null;
      };
    };
    expect(call.creationData.maintenanceCardId).toBe(cardId);
    expect(call.creationData.doneAtMileage).toBe(12500);
    expect(call.creationData.doneAtDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(call.creationData.doneAtDate.getTime()).toBeLessThanOrEqual(after.getTime());
    expect(call.creationData.notes).toBeNull();
  });

  it('resets nextDueMileage when intervalMileage is set', async () => {
    await service.markDone(cardId, vehicleId, userId, { doneAtMileage: 12500 });

    const savedCard = (
      mockMaintenanceCardRepository.updateWithSave.mock.calls[0]?.[0] as {
        dataArray: Array<{ nextDueMileage: number }>;
      }
    ).dataArray[0];
    expect(savedCard.nextDueMileage).toBe(18500); // 12500 + 6000
  });

  it('resets nextDueDate when intervalTimeMonths is set', async () => {
    await service.markDone(cardId, vehicleId, userId, { doneAtMileage: 12500 });

    const savedCard = (
      mockMaintenanceCardRepository.updateWithSave.mock.calls[0]?.[0] as {
        dataArray: Array<{ nextDueDate: Date | null }>;
      }
    ).dataArray[0];
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

  it('throws BadRequestException when card has intervalMileage but doneAtMileage is not provided', async () => {
    await expect(
      service.markDone(cardId, vehicleId, userId, {}),
    ).rejects.toThrow(BadRequestException);
  });

  it('succeeds for a time-only card when doneAtMileage is not provided', async () => {
    mockMaintenanceCardRepository.getOne.mockResolvedValue({
      ...baseCard,
      intervalMileage: null,
      intervalTimeMonths: 6,
      nextDueMileage: null,
      nextDueDate: null,
    });

    const result = await service.markDone(cardId, vehicleId, userId, {});

    expect(result).toEqual(baseHistory);
    expect(mockVehicleService.updateVehicle).not.toHaveBeenCalled();
    const call = mockHistoryRepository.create.mock.calls[0]?.[0] as {
      creationData: { doneAtMileage: number | null };
    };
    expect(call.creationData.doneAtMileage).toBeNull();
  });

  it('passes notes through to the history record', async () => {
    await service.markDone(cardId, vehicleId, userId, {
      doneAtMileage: 12500,
      notes: 'replaced oil filter too',
    });

    const call = mockHistoryRepository.create.mock.calls[0]?.[0] as {
      creationData: { notes: string | null };
    };
    expect(call.creationData.notes).toBe('replaced oil filter too');
  });

  it('returns the created history record', async () => {
    const result = await service.markDone(cardId, vehicleId, userId, { doneAtMileage: 12500 });
    expect(result).toEqual(baseHistory);
  });

  it('runs card update and history creation within the same transaction', async () => {
    await service.markDone(cardId, vehicleId, userId, { doneAtMileage: 12500 });

    const updateCall = mockMaintenanceCardRepository.updateWithSave.mock
      .calls[0]?.[0] as { entityManager: unknown };
    expect(updateCall.entityManager).toBe(mockEntityManager);

    const createCall = mockHistoryRepository.create.mock.calls[0]?.[0] as {
      entityManager: unknown;
    };
    expect(createCall.entityManager).toBe(mockEntityManager);
  });

  it('propagates error and does not commit when history creation fails', async () => {
    mockHistoryRepository.create.mockRejectedValue(new Error('DB insert failed'));

    await expect(
      service.markDone(cardId, vehicleId, userId, { doneAtMileage: 12500 }),
    ).rejects.toThrow('DB insert failed');
  });

  it('does NOT update vehicle mileage when the transaction fails', async () => {
    mockHistoryRepository.create.mockRejectedValue(new Error('DB insert failed'));

    await expect(
      service.markDone(cardId, vehicleId, userId, { doneAtMileage: 12500 }),
    ).rejects.toThrow('DB insert failed');

    expect(mockVehicleService.updateVehicle).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

```bash
cd backend && pnpm exec vitest run src/modules/maintenance-card/services/maintenance-card.service.spec.ts
```

Expected: FAIL — `markDone` not found, provider mismatch.

- [x] **Step 3: Update `MaintenanceCardService`**

In `backend/src/modules/maintenance-card/services/maintenance-card.service.ts`:

Update the `@nestjs/common` import to include `BadRequestException`. Then add new imports:

```typescript
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { MaintenanceHistoryEntity } from 'src/db/entities/maintenance-history.entity';
import { MaintenanceHistoryRepository } from '../repositories/maintenance-history.repository';
```

Add `MarkDoneInput` type after the existing type declarations:

```typescript
export type MarkDoneInput = {
  doneAtMileage?: number | null;
  notes?: string | null;
};
```

Update the constructor to inject `MaintenanceHistoryRepository` and `DataSource`:

```typescript
constructor(
  private readonly cardRepository: MaintenanceCardRepository,
  private readonly historyRepository: MaintenanceHistoryRepository,
  private readonly vehicleService: VehicleService,
  @InjectDataSource() private readonly dataSource: DataSource,
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
  const [vehicle, card] = await Promise.all([
    this.vehicleService.getVehicle(vehicleId, userId),
    this.cardRepository.getOne({ criteria: { id, vehicleId } }),
  ]);
  if (!card) throw new NotFoundException('Maintenance card not found');

  if (card.intervalMileage !== null) {
    if (input.doneAtMileage == null) {
      throw new BadRequestException(
        'doneAtMileage is required when the card has an intervalMileage',
      );
    }
    card.nextDueMileage = input.doneAtMileage + card.intervalMileage;
  }

  const today = new Date();

  if (card.intervalTimeMonths !== null) {
    const nextDue = new Date(today);
    nextDue.setMonth(nextDue.getMonth() + card.intervalTimeMonths);
    card.nextDueDate = nextDue;
  }

  // TODO: BackgroundJob cancellation deferred to Plan 08

  const history = await this.dataSource.transaction(async (em) => {
    await this.cardRepository.updateWithSave({
      dataArray: [card],
      entityManager: em,
    });
    return this.historyRepository.create({
      creationData: {
        maintenanceCardId: id,
        doneAtMileage: input.doneAtMileage ?? null,
        doneAtDate: today,
        notes: input.notes ?? null,
      },
      entityManager: em,
    });
  });

  if (input.doneAtMileage != null && input.doneAtMileage > vehicle.mileage) {
    await this.vehicleService.updateVehicle(vehicleId, userId, {
      mileage: input.doneAtMileage,
    });
  }

  return history;
}
```

- [x] **Step 4: Run the test to verify it passes**

```bash
cd backend && pnpm exec vitest run src/modules/maintenance-card/services/maintenance-card.service.spec.ts
```

Expected: PASS

- [x] **Step 5: Commit**

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

- [x] **Step 1: Write the failing test**

> ⚠️ **Deviations:** No `forwardRef` on `VehicleService` [D2]; parallel fetch via `Promise.all` [D4]; `getOneWithDeleted` called with positional args [D1].

Create `backend/src/modules/maintenance-card/services/maintenance-history.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MaintenanceHistoryService } from './maintenance-history.service';
import { MaintenanceHistoryRepository } from '../repositories/maintenance-history.repository';
import { MaintenanceCardRepository } from '../repositories/maintenance-card.repository';
import { VehicleService } from 'src/modules/vehicle/services/vehicle.service';
import { MILEAGE_UNITS, MAINTENANCE_CARD_TYPES } from '@project/types';

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
  mileageUnit: MILEAGE_UNITS.KM,
};

const baseCard = {
  id: cardId,
  vehicleId,
  type: MAINTENANCE_CARD_TYPES.TASK,
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

      expect(mockCardRepository.getOneWithDeleted).toHaveBeenCalledWith(
        cardId,
        vehicleId,
      );
    });

    it('throws NotFoundException when card does not exist (even with deleted check)', async () => {
      mockVehicleService.getVehicle.mockResolvedValue(baseVehicle);
      mockCardRepository.getOneWithDeleted.mockResolvedValue(null);

      await expect(
        service.listHistory(cardId, vehicleId, userId),
      ).rejects.toThrow(NotFoundException);

      expect(mockHistoryRepository.findByCardId).not.toHaveBeenCalled();
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

- [x] **Step 2: Run the test to verify it fails**

```bash
cd backend && pnpm exec vitest run src/modules/maintenance-card/services/maintenance-history.service.spec.ts
```

Expected: FAIL — `MaintenanceHistoryService` not found.

- [x] **Step 3: Create `MaintenanceHistoryService`**

Create `backend/src/modules/maintenance-card/services/maintenance-history.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { MaintenanceHistoryEntity } from 'src/db/entities/maintenance-history.entity';
import { VehicleService } from 'src/modules/vehicle/services/vehicle.service';
import { MaintenanceCardRepository } from '../repositories/maintenance-card.repository';
import { MaintenanceHistoryRepository } from '../repositories/maintenance-history.repository';

@Injectable()
export class MaintenanceHistoryService {
  constructor(
    private readonly historyRepository: MaintenanceHistoryRepository,
    private readonly cardRepository: MaintenanceCardRepository,
    private readonly vehicleService: VehicleService,
  ) {}

  async listHistory(
    cardId: string,
    vehicleId: string,
    userId: string,
  ): Promise<MaintenanceHistoryEntity[]> {
    const [, card] = await Promise.all([
      this.vehicleService.getVehicle(vehicleId, userId),
      this.cardRepository.getOneWithDeleted(cardId, vehicleId),
    ]);
    if (!card) throw new NotFoundException('Maintenance card not found');

    return this.historyRepository.findByCardId(cardId);
  }
}
```

- [x] **Step 4: Run the test to verify it passes**

```bash
cd backend && pnpm exec vitest run src/modules/maintenance-card/services/maintenance-history.service.spec.ts
```

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add backend/src/modules/maintenance-card/services/maintenance-history.service.ts \
        backend/src/modules/maintenance-card/services/maintenance-history.service.spec.ts
git commit -m "feat: add MaintenanceHistoryService"
```

---

## Chunk 6: Controller Routes

### Task 6: Add `mark-done` and `history` routes to `MaintenanceCardController`

**Files:**
- Create: `backend/src/modules/maintenance-card/dtos/mark-done.dto.ts` _(plan named this `complete.dto.ts` — see [D7](#d7-dto-filename-and-route-path))_
- Modify: `backend/src/modules/maintenance-card/controllers/maintenance-card.controller.ts`
- Modify: `backend/src/modules/maintenance-card/controllers/maintenance-card.controller.spec.ts`

- [x] **Step 1: Create `mark-done.dto.ts`**

> ⚠️ **Deviation [D7]:** File created as `mark-done.dto.ts` (not `complete.dto.ts`) — see [D7](#d7-dto-filename-and-route-path).

Create `backend/src/modules/maintenance-card/dtos/mark-done.dto.ts`:

```typescript
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import type { IMarkDoneReqDTO } from '@project/types';

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

- [x] **Step 2: Add failing tests for the two new routes**

In `backend/src/modules/maintenance-card/controllers/maintenance-card.controller.spec.ts`:

Add to the import block at the top:

```typescript
import { MaintenanceHistoryService } from '../services/maintenance-history.service';
```

Add to mock service declarations (inside the describe block, before `beforeEach`):

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
it('POST /vehicles/:vehicleId/maintenance-cards/:id/mark-done returns 201 with history DTO', async () => {
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

- [x] **Step 3: Run the test to verify it fails**

```bash
cd backend && pnpm exec vitest run src/modules/maintenance-card/controllers/maintenance-card.controller.spec.ts
```

Expected: FAIL — `markDone` and `listHistory` methods not found on controller.

- [x] **Step 4: Update `MaintenanceCardController`**

> ⚠️ **Deviations:** Route is `@Post(':id/mark-done')` (not `/complete`) [D7]; `historyToResDTO` calls `.toISOString()` directly without `new Date()` wrap [D8]; `import type` for `IMarkDoneReqDTO` [D10].

In `backend/src/modules/maintenance-card/controllers/maintenance-card.controller.ts`:

Add to the import block:

```typescript
import type { IMaintenanceHistoryResDTO } from '@project/types';
import { MaintenanceHistoryEntity } from 'src/db/entities/maintenance-history.entity';
import { MaintenanceHistoryService } from '../services/maintenance-history.service';
import { MarkDoneDto } from '../dtos/mark-done.dto';
```

Add `historyToResDTO` helper after the existing `toResDTO` function:

```typescript
function historyToResDTO(
  history: MaintenanceHistoryEntity,
): IMaintenanceHistoryResDTO {
  return {
    id: history.id,
    maintenanceCardId: history.maintenanceCardId,
    doneAtMileage: history.doneAtMileage,
    doneAtDate: history.doneAtDate.toISOString(),
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
@Post(':id/mark-done')
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

- [x] **Step 5: Run the test to verify it passes**

```bash
cd backend && pnpm exec vitest run src/modules/maintenance-card/controllers/maintenance-card.controller.spec.ts
```

Expected: PASS

- [x] **Step 6: Commit**

```bash
git add backend/src/modules/maintenance-card/dtos/mark-done.dto.ts \
        backend/src/modules/maintenance-card/controllers/maintenance-card.controller.ts \
        backend/src/modules/maintenance-card/controllers/maintenance-card.controller.spec.ts
git commit -m "feat: add complete and history routes to MaintenanceCardController"
```

---

## Chunk 7: Module Registration

### Task 7: Update `MaintenanceCardModule` to register new providers and entity

**Files:**
- Modify: `backend/src/modules/maintenance-card/maintenance-card.module.ts`

- [x] **Step 1: Update `MaintenanceCardModule`**

> ⚠️ **Deviation [D9]:** `VehicleModule` imported directly without `forwardRef` — see [D9](#d9-no-forwardref-for-vehiclemodule).

Replace the content of `backend/src/modules/maintenance-card/maintenance-card.module.ts` with:

```typescript
import { Module } from '@nestjs/common';
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
    VehicleModule,
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

- [x] **Step 2: Run all unit tests**

```bash
just test-unit
```

Expected: All tests pass. ✅ Verified: 70/70 tests pass (2026-03-19).

- [x] **Step 3: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [ ] **Step 4: Smoke test the API** _(manual — requires running services)_

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
curl -s -X POST "http://localhost:3001/vehicles/$VEHICLE_ID/maintenance-cards/$CARD_ID/mark-done" \
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

- [x] **Step 5: Commit**

```bash
git add backend/src/modules/maintenance-card/maintenance-card.module.ts
git commit -m "feat: register MaintenanceHistoryEntity and providers in MaintenanceCardModule"
```

---

## Deviations from Plan

The following changes were made during implementation that differ from the original plan. Each deviation was driven by code review feedback or a correctness bug found during implementation.

---

### D1: `getOneWithDeleted` positional signature

**Plan:** `getOneWithDeleted(criteria: { id: string; vehicleId: string })`

**Actual:** `getOneWithDeleted(id: string, vehicleId: string)`

**Why:** A two-field criteria object is just positional args with extra syntax. Two named positional parameters are equally readable with less ceremony. The object wrapper adds no value when the method has only two parameters that are always passed together.

**Impact:** Tests and all callers (`MaintenanceHistoryService`) updated to use positional args.

---

### D2: No `forwardRef` on `VehicleService`

**Plan:** Constructor used `@Inject(forwardRef(() => VehicleService))` in both `MaintenanceCardService` and `MaintenanceHistoryService`.

**Actual:** `VehicleService` injected as a plain constructor parameter with no `@Inject` decorator.

**Why:** `forwardRef` is only needed when two modules have a circular import dependency at the NestJS module level. `MaintenanceCardModule` imports `VehicleModule` (one direction only); there is no circular dependency. Using `forwardRef` unnecessarily adds runtime complexity and obscures the actual dependency graph.

---

### D3: `DataSource` transaction wrapping in `markDone`

**Plan:** `cardRepository.updateWithSave` and `historyRepository.create` called sequentially as independent operations.

**Actual:** Both are wrapped in a single `dataSource.transaction(async (em) => { ... })` call. `@InjectDataSource() private readonly dataSource: DataSource` added to the constructor.

**Why:** This was a critical correctness bug in the plan. If `updateWithSave` succeeds but `historyRepository.create` fails (e.g. DB constraint violation), the card's `nextDueMileage`/`nextDueDate` would be updated with no corresponding history record — an inconsistent state. Wrapping both writes in a transaction ensures atomicity: either both succeed or neither does. Tests mock `dataSource` with `getDataSourceToken()`.

---

### D4: Parallel fetch of vehicle and card

**Plan:** `markDone` fetched vehicle first (`getVehicle`), then card sequentially (`getCard`). `listHistory` fetched vehicle first, then card sequentially.

**Actual:** Both services use `Promise.all([getVehicle(...), getOne/getOneWithDeleted(...)])` to fire both fetches concurrently.

**Why:** The two fetches are independent — neither result is needed to compute the other's input. Running them in parallel cuts the round-trip latency in half with no correctness trade-off.

---

### D5: `updateVehicle` called after the transaction

**Plan:** `updateVehicle` was called before `updateWithSave` and `historyRepository.create`.

**Actual:** `updateVehicle` is called after the `dataSource.transaction(...)` block completes successfully.

**Why:** External service calls (to `VehicleService`) must not be placed inside a DB transaction. If the vehicle update succeeded but the transaction rolled back, the vehicle mileage would be wrong with no history to explain it. By calling `updateVehicle` only after the transaction commits, the vehicle mileage update is contingent on successful history + card-update persistence.

---

### D6: Removed `mileageForReset` fallback; replaced test

**Plan:**
- A `mileageForReset` variable was computed as `input.doneAtMileage ?? vehicle.mileage`.
- A test "uses vehicle.mileage for nextDueMileage when doneAtMileage is not provided" expected `nextDueMileage = vehicle.mileage + intervalMileage`.

**Actual:**
- No `mileageForReset` variable. When `card.intervalMileage !== null`, `doneAtMileage` is required (throws `BadRequestException` otherwise), so `nextDueMileage = input.doneAtMileage + card.intervalMileage` directly.
- The "vehicle.mileage fallback" test was replaced with "succeeds for a time-only card when doneAtMileage is not provided" — which verifies that a card with `intervalMileage: null` (time-only) can be marked done without a mileage value.

**Why:** The fallback `vehicle.mileage` case was only reachable when `intervalMileage !== null` and `doneAtMileage == null` — but validation already throws in that case, so the fallback was dead code. Removing it eliminates a branch that can never execute and makes the intent explicit: mileage-based intervals always require the mileage to be provided. The replacement test covers the genuine edge case: cards that track only time (no mileage interval) should never require a mileage.

---

### D7: DTO filename and route path renamed

**Plan:**
- DTO file: `dtos/complete.dto.ts`
- Route decorator: `@Post(':id/complete')`

**Actual:**
- DTO file: `dtos/mark-done.dto.ts`
- Route decorator: `@Post(':id/mark-done')`

**Why:** The feature is named "mark done" throughout the codebase (method `markDone`, type `MarkDoneInput`, DTO interface `IMarkDoneReqDTO`). Naming the file and route `/complete` was an inconsistency identified in code review. Renaming to `mark-done` makes all names consistent.

---

### D8: Redundant `new Date()` wrap removed in `historyToResDTO`

**Plan:** `doneAtDate: new Date(history.doneAtDate).toISOString()`

**Actual:** `doneAtDate: history.doneAtDate.toISOString()`

**Why:** TypeORM maps `TIMESTAMP` columns to native `Date` objects. `history.doneAtDate` is already a `Date` — wrapping it in `new Date()` is a no-op. Removing the redundant wrap is cleaner and reflects the actual type.

---

### D9: No `forwardRef` for `VehicleModule` in module imports

**Plan:** `forwardRef(() => VehicleModule)` in `MaintenanceCardModule` imports array.

**Actual:** `VehicleModule` imported directly.

**Why:** Same reasoning as D2 — `forwardRef` in module imports is only needed for circular module dependencies. `MaintenanceCardModule → VehicleModule` is a one-way dependency. Using `forwardRef` here was unnecessary and misleading.

---

### D10: `import type` for `@project/types` in controller

**Plan:** `import { IMarkDoneReqDTO } from '@project/types'`

**Actual:** `import type { IMarkDoneReqDTO } from '@project/types'`

**Why:** Per project convention (documented in CLAUDE.md): `isolatedModules` + `emitDecoratorMetadata` requires `import type` (or namespace import) when a type from an external package is referenced in a decorated class. Using a value import causes TypeScript to emit metadata for the type, which fails at runtime when `isolatedModules` strips the type.

---

### D11: `doneAtDate` formatted as `YYYY-MM-DD` (post-merge fix)

**Original code:** `doneAtDate: history.doneAtDate.toISOString()`

**Fixed code:** `doneAtDate: history.doneAtDate.toISOString().slice(0, 10)`

**Why:** `MaintenanceHistoryEntity.doneAtDate` is a PostgreSQL `date` column (not `timestamptz`). TypeORM returns it as a JavaScript `Date` object anchored at midnight UTC, so `.toISOString()` produces `"2026-03-15T00:00:00.000Z"` — a timestamp, not a date. Slicing to 10 characters yields `"2026-03-15"`, which is consistent with how `nextDueDate` is serialized in `toResDTO` and correctly represents the intent of a date-only column.

---

## Rejected Review Feedback

The following suggestions were raised in code review (2026-03-19) and evaluated against the codebase. Each was rejected with technical reasoning.

---

### R1: Move `updateVehicle` inside the transaction

**Suggestion:** Include the vehicle mileage update inside the `dataSource.transaction(...)` block to prevent inconsistency if `updateVehicle` fails after the transaction commits.

**Rejected because:** This is the intentional design documented in D5. External service calls (`VehicleService.updateVehicle`) must not be placed inside a DB transaction — doing so would hold the transaction open across an external call, increasing lock contention and coupling infrastructure concerns across service boundaries. The current ordering (update vehicle only after the transaction commits) is the correct approach: a failed vehicle update leaves the card and history in a consistent committed state with the mileage update as best-effort. Moving `updateVehicle` inside the transaction would be architecturally worse, not better.

---

### R2: Replace `@IsNumber()` with `@IsInt()` on `doneAtMileage`

**Suggestion:** Use `@IsInt()` instead of `@IsNumber()` on `doneAtMileage` in `mark-done.dto.ts` to prevent float inputs.

**Rejected because:** `@IsNumber()` is the established pattern for mileage fields in this codebase — `create-vehicle.dto.ts` and `update-vehicle.dto.ts` both use `@IsNumber()` for their `mileage` field. The `MaintenanceHistoryEntity` also stores `doneAtMileage` as `decimal(10,2)`, a type that explicitly supports fractional values. Switching to `@IsInt()` here would create an inconsistency with the vehicle DTOs and contradict the entity schema.

---

### R3: Route path `/mark-done` inconsistent with PR description `/complete`

**Suggestion:** Align the route path with the PR description, which refers to `POST .../complete`.

**Rejected because:** The route `@Post(':id/mark-done')` is the intentional implementation per D7. The PR description contained stale wording from the original spec; the rename to `mark-done` was a deliberate decision made during implementation for naming consistency across the codebase (method `markDone`, type `MarkDoneInput`, DTO `IMarkDoneReqDTO`, file `mark-done.dto.ts`). The code is correct; the PR description was the source of the discrepancy.
