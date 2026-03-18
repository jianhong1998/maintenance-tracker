# Plan 05: Maintenance Card Management

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full Maintenance Card CRUD API — list (with sort), create, get single, update, soft delete — with vehicle ownership enforcement. Also complete the Vehicle delete cascade (soft-delete all cards on vehicle delete) deferred from Plan 04.

**Architecture:** `MaintenanceCardModule` contains a `MaintenanceCardRepository`, `MaintenanceCardService`, and `MaintenanceCardController`. All card endpoints are nested under `/vehicles/:vehicleId`. Vehicle ownership is verified before every card operation. Sort is applied server-side by the service. The Vehicle delete cascade is added to `VehicleService` now that `MaintenanceCardRepository` exists.

**Tech Stack:** NestJS, TypeORM (`MaintenanceCardEntity`, `VehicleEntity`), class-validator, `@project/types`

**Spec reference:** `docs/superpowers/specs/2026-03-14-maintenance-tracker-design.md` — Section 3 (MaintenanceCard data model), Section 4 (Maintenance Cards API, patchable fields), Section 5 (Urgency sort), Section 7 (Soft delete cascade)

**Prerequisites:** Plans 01–04 must be complete.

---

## Chunk 1: Shared Types

### Task 1: Add Maintenance Card DTOs to `@project/types`

**Files:**
- Create: `packages/types/src/dtos/maintenance-card.dto.ts`
- Modify: `packages/types/src/dtos/index.ts`

- [x] **Step 1: Create `maintenance-card.dto.ts`**

Create `packages/types/src/dtos/maintenance-card.dto.ts`:

```typescript
export type MaintenanceCardType = 'task' | 'part' | 'item';

export interface ICreateMaintenanceCardReqDTO {
  type: MaintenanceCardType;
  name: string;
  description?: string | null;
  intervalMileage?: number | null;
  intervalTimeMonths?: number | null;
}

export interface IUpdateMaintenanceCardReqDTO {
  type?: MaintenanceCardType;
  name?: string;
  description?: string | null;
  intervalMileage?: number | null;
  intervalTimeMonths?: number | null;
}

export interface IMaintenanceCardResDTO {
  id: string;
  vehicleId: string;
  type: MaintenanceCardType;
  name: string;
  description: string | null;
  intervalMileage: number | null;
  intervalTimeMonths: number | null;
  nextDueMileage: number | null;
  nextDueDate: string | null;
  createdAt: string;
  updatedAt: string;
}
```

- [x] **Step 2: Re-export from `packages/types/src/dtos/index.ts`**

Add to `packages/types/src/dtos/index.ts`:

```typescript
export * from './maintenance-card.dto';
```

- [x] **Step 3: Build `@project/types`**

```bash
cd packages/types && pnpm run build
```

Expected: No TypeScript errors.

- [x] **Step 4: Commit**

```bash
git add packages/types/src/dtos/maintenance-card.dto.ts packages/types/src/dtos/index.ts
git commit -m "feat: add MaintenanceCard DTOs to shared types"
```

---

## Chunk 2: MaintenanceCardModule

### Task 2: Create `MaintenanceCardRepository`

**Files:**
- Create: `backend/src/modules/maintenance-card/repositories/maintenance-card.repository.ts`
- Create: `backend/src/modules/maintenance-card/repositories/maintenance-card.repository.spec.ts`

- [x] **Step 1: Write the failing test**

Create `backend/src/modules/maintenance-card/repositories/maintenance-card.repository.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MaintenanceCardRepository } from './maintenance-card.repository';
import {
  MaintenanceCardEntity,
  MaintenanceCardType,
} from 'src/db/entities/maintenance-card.entity';

const mockTypeOrmRepo = {
  create: vi.fn(),
  save: vi.fn(),
};

describe('MaintenanceCardRepository', () => {
  let repository: MaintenanceCardRepository;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceCardRepository,
        {
          provide: getRepositoryToken(MaintenanceCardEntity),
          useValue: mockTypeOrmRepo,
        },
      ],
    }).compile();

    repository = module.get<MaintenanceCardRepository>(MaintenanceCardRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('#create', () => {
    it('creates and saves a new maintenance card', async () => {
      const newCard = {
        id: 'card-1',
        vehicleId: 'vehicle-1',
        type: MaintenanceCardType.TASK,
        name: 'CVT Cleaning',
        description: null,
        intervalMileage: 6000,
        intervalTimeMonths: 6,
        nextDueMileage: null,
        nextDueDate: null,
      } as MaintenanceCardEntity;

      mockTypeOrmRepo.create.mockReturnValue(newCard);
      mockTypeOrmRepo.save.mockResolvedValue(newCard);

      const result = await repository.create({
        creationData: {
          vehicleId: 'vehicle-1',
          type: MaintenanceCardType.TASK,
          name: 'CVT Cleaning',
          description: null,
          intervalMileage: 6000,
          intervalTimeMonths: 6,
        },
      });

      expect(result).toEqual(newCard);
    });
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

```bash
cd backend && pnpm exec vitest run src/modules/maintenance-card/repositories/maintenance-card.repository.spec.ts
```

Expected: FAIL — `MaintenanceCardRepository` not found.

- [x] **Step 3: Create `MaintenanceCardRepository`**

Create `backend/src/modules/maintenance-card/repositories/maintenance-card.repository.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  MaintenanceCardEntity,
  MaintenanceCardType,
} from 'src/db/entities/maintenance-card.entity';
import { BaseDBUtil } from 'src/modules/common/base-classes/base-db-util';

export type CreateMaintenanceCardData = {
  vehicleId: string;
  type: MaintenanceCardType;
  name: string;
  description: string | null;
  intervalMileage: number | null;
  intervalTimeMonths: number | null;
};

@Injectable()
export class MaintenanceCardRepository extends BaseDBUtil<
  MaintenanceCardEntity,
  CreateMaintenanceCardData
> {
  constructor(
    @InjectRepository(MaintenanceCardEntity)
    private readonly cardRepo: Repository<MaintenanceCardEntity>,
  ) {
    super(MaintenanceCardEntity, cardRepo);
  }

  async create(params: {
    creationData: CreateMaintenanceCardData;
    entityManager?: EntityManager;
  }): Promise<MaintenanceCardEntity> {
    const { creationData, entityManager } = params;
    const repo =
      (entityManager?.getRepository(
        MaintenanceCardEntity,
      ) as Repository<MaintenanceCardEntity>) ?? this.cardRepo;

    const card = repo.create(creationData);
    return await repo.save(card);
  }
}
```

- [x] **Step 4: Run the test to verify it passes**

```bash
cd backend && pnpm exec vitest run src/modules/maintenance-card/repositories/maintenance-card.repository.spec.ts
```

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add backend/src/modules/maintenance-card/repositories/
git commit -m "feat: add MaintenanceCardRepository"
```

---

### Task 3: Create `MaintenanceCardService`

**Files:**
- Create: `backend/src/modules/maintenance-card/services/maintenance-card.service.ts`
- Create: `backend/src/modules/maintenance-card/services/maintenance-card.service.spec.ts`

**Sort logic:**
- `urgency`: overdue cards first (date overdue, then mileage-only overdue), then non-overdue by `nextDueDate` asc, then by `nextDueMileage` asc, then cards with no due info last.
- `name`: alphabetical by name asc.

- [x] **Step 1: Write the failing test**

Create `backend/src/modules/maintenance-card/services/maintenance-card.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MaintenanceCardService } from './maintenance-card.service';
import { MaintenanceCardRepository } from '../repositories/maintenance-card.repository';
import { VehicleService } from 'src/modules/vehicle/services/vehicle.service';
import { MaintenanceCardType } from 'src/db/entities/maintenance-card.entity';
import { MileageUnit } from 'src/db/entities/vehicle.entity';

const mockMaintenanceCardRepository = {
  getAll: vi.fn(),
  getOne: vi.fn(),
  create: vi.fn(),
  updateWithSave: vi.fn(),
  delete: vi.fn(),
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
  nextDueMileage: 12000,
  nextDueDate: new Date('2026-09-01'),
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

describe('MaintenanceCardService', () => {
  let service: MaintenanceCardService;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockVehicleService.getVehicle.mockResolvedValue(baseVehicle);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceCardService,
        {
          provide: MaintenanceCardRepository,
          useValue: mockMaintenanceCardRepository,
        },
        { provide: VehicleService, useValue: mockVehicleService },
      ],
    }).compile();

    service = module.get<MaintenanceCardService>(MaintenanceCardService);
  });

  describe('#listCards', () => {
    it('returns cards sorted by name when sort=name', async () => {
      const cardA = { ...baseCard, id: 'card-a', name: 'Brake Pads' };
      const cardB = { ...baseCard, id: 'card-b', name: 'Air Filter' };
      mockMaintenanceCardRepository.getAll.mockResolvedValue([cardA, cardB]);

      const result = await service.listCards(vehicleId, userId, 'name');

      expect(result[0].name).toBe('Air Filter');
      expect(result[1].name).toBe('Brake Pads');
    });

    it('returns overdue cards first when sort=urgency', async () => {
      const today = new Date();
      const pastDate = new Date(today);
      pastDate.setDate(today.getDate() - 1);
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + 30);

      const overdueCard = {
        ...baseCard,
        id: 'card-overdue',
        name: 'Overdue Task',
        nextDueDate: pastDate,
        nextDueMileage: null,
      };
      const okCard = {
        ...baseCard,
        id: 'card-ok',
        name: 'Fine Task',
        nextDueDate: futureDate,
        nextDueMileage: null,
      };
      mockMaintenanceCardRepository.getAll.mockResolvedValue([okCard, overdueCard]);

      const result = await service.listCards(vehicleId, userId, 'urgency');

      expect(result[0].id).toBe('card-overdue');
    });

    it('places mileage-only-overdue cards after date-overdue cards when sort=urgency', async () => {
      const today = new Date();
      const pastDate = new Date(today);
      pastDate.setDate(today.getDate() - 1);

      const dateOverdueCard = {
        ...baseCard,
        id: 'card-date-overdue',
        name: 'Date Overdue',
        nextDueDate: pastDate,
        nextDueMileage: null,
      };
      const mileageOverdueCard = {
        ...baseCard,
        id: 'card-mileage-overdue',
        name: 'Mileage Overdue',
        nextDueDate: null,
        nextDueMileage: 5000, // vehicle mileage is 10000 → overdue
      };
      mockMaintenanceCardRepository.getAll.mockResolvedValue([
        mileageOverdueCard,
        dateOverdueCard,
      ]);

      const result = await service.listCards(vehicleId, userId, 'urgency');

      expect(result[0].id).toBe('card-date-overdue');
      expect(result[1].id).toBe('card-mileage-overdue');
    });

    it('places both-dimension-overdue card in date-overdue group when sort=urgency', async () => {
      const today = new Date();
      const pastDate = new Date(today);
      pastDate.setDate(today.getDate() - 1);

      const bothOverdueCard = {
        ...baseCard,
        id: 'card-both-overdue',
        name: 'Both Overdue',
        nextDueDate: pastDate,
        nextDueMileage: 5000, // vehicle mileage is 10000 → also overdue
      };
      const mileageOnlyCard = {
        ...baseCard,
        id: 'card-mileage-only',
        name: 'Mileage Only Overdue',
        nextDueDate: null,
        nextDueMileage: 5000,
      };
      mockMaintenanceCardRepository.getAll.mockResolvedValue([
        mileageOnlyCard,
        bothOverdueCard,
      ]);

      const result = await service.listCards(vehicleId, userId, 'urgency');

      expect(result[0].id).toBe('card-both-overdue'); // date group first
      expect(result[1].id).toBe('card-mileage-only');
    });

    it('sorts non-overdue cards by nextDueDate ascending when sort=urgency', async () => {
      const today = new Date();
      const near = new Date(today);
      near.setDate(today.getDate() + 10);
      const far = new Date(today);
      far.setDate(today.getDate() + 60);

      const nearCard = {
        ...baseCard,
        id: 'card-near',
        name: 'Near Due',
        nextDueDate: near,
        nextDueMileage: null,
      };
      const farCard = {
        ...baseCard,
        id: 'card-far',
        name: 'Far Due',
        nextDueDate: far,
        nextDueMileage: null,
      };
      mockMaintenanceCardRepository.getAll.mockResolvedValue([farCard, nearCard]);

      const result = await service.listCards(vehicleId, userId, 'urgency');

      expect(result[0].id).toBe('card-near');
      expect(result[1].id).toBe('card-far');
    });

    it('places cards with no due info last when sort=urgency', async () => {
      const today = new Date();
      const future = new Date(today);
      future.setDate(today.getDate() + 30);

      const noDueCard = {
        ...baseCard,
        id: 'card-no-due',
        name: 'No Due Info',
        nextDueDate: null,
        nextDueMileage: null,
      };
      const normalCard = {
        ...baseCard,
        id: 'card-normal',
        name: 'Has Due Date',
        nextDueDate: future,
        nextDueMileage: null,
      };
      mockMaintenanceCardRepository.getAll.mockResolvedValue([noDueCard, normalCard]);

      const result = await service.listCards(vehicleId, userId, 'urgency');

      expect(result[result.length - 1].id).toBe('card-no-due');
    });

    it('verifies vehicle ownership by calling VehicleService.getVehicle', async () => {
      mockMaintenanceCardRepository.getAll.mockResolvedValue([]);

      await service.listCards(vehicleId, userId, 'name');

      expect(mockVehicleService.getVehicle).toHaveBeenCalledWith(vehicleId, userId);
    });
  });

  describe('#getCard', () => {
    it('returns the card when it belongs to the vehicle', async () => {
      mockMaintenanceCardRepository.getOne.mockResolvedValue(baseCard);

      const result = await service.getCard(cardId, vehicleId, userId);

      expect(result).toEqual(baseCard);
    });

    it('throws NotFoundException when card not found', async () => {
      mockMaintenanceCardRepository.getOne.mockResolvedValue(null);

      await expect(service.getCard(cardId, vehicleId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('#createCard', () => {
    it('creates a card for the verified vehicle', async () => {
      mockMaintenanceCardRepository.create.mockResolvedValue(baseCard);

      const result = await service.createCard(vehicleId, userId, {
        type: MaintenanceCardType.TASK,
        name: 'CVT Cleaning',
        description: null,
        intervalMileage: 6000,
        intervalTimeMonths: 6,
      });

      expect(result).toEqual(baseCard);
    });

    it('throws BadRequestException when both intervalMileage and intervalTimeMonths are null', async () => {
      await expect(
        service.createCard(vehicleId, userId, {
          type: MaintenanceCardType.TASK,
          name: 'CVT Cleaning',
          description: null,
          intervalMileage: null,
          intervalTimeMonths: null,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('#updateCard', () => {
    it('updates and returns the card with patched fields applied', async () => {
      const updated = { ...baseCard, name: 'Updated Name' };
      mockMaintenanceCardRepository.getOne.mockResolvedValue(baseCard);
      mockMaintenanceCardRepository.updateWithSave.mockResolvedValue([updated]);

      const result = await service.updateCard(cardId, vehicleId, userId, {
        name: 'Updated Name',
      });

      expect(mockMaintenanceCardRepository.updateWithSave).toHaveBeenCalledWith({
        dataArray: [expect.objectContaining({ name: 'Updated Name' })],
      });
      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when card not found', async () => {
      mockMaintenanceCardRepository.getOne.mockResolvedValue(null);

      await expect(
        service.updateCard(cardId, vehicleId, userId, { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when update would nullify both intervals', async () => {
      const cardWithBothIntervals = {
        ...baseCard,
        intervalMileage: 6000,
        intervalTimeMonths: 6,
      };
      mockMaintenanceCardRepository.getOne.mockResolvedValue(cardWithBothIntervals);

      await expect(
        service.updateCard(cardId, vehicleId, userId, {
          intervalMileage: null,
          intervalTimeMonths: null,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('#deleteCard', () => {
    it('soft deletes the card', async () => {
      mockMaintenanceCardRepository.getOne.mockResolvedValue(baseCard);
      mockMaintenanceCardRepository.delete.mockResolvedValue([baseCard]);

      await service.deleteCard(cardId, vehicleId, userId);

      expect(mockMaintenanceCardRepository.delete).toHaveBeenCalledWith({
        criteria: { id: cardId, vehicleId },
      });
    });

    it('throws NotFoundException when card not found', async () => {
      mockMaintenanceCardRepository.getOne.mockResolvedValue(null);

      await expect(service.deleteCard(cardId, vehicleId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('#deleteCardsByVehicleId', () => {
    it('calls delete with vehicleId criteria', async () => {
      mockMaintenanceCardRepository.delete.mockResolvedValue([baseCard]);

      await service.deleteCardsByVehicleId(vehicleId);

      expect(mockMaintenanceCardRepository.delete).toHaveBeenCalledWith({
        criteria: { vehicleId },
      });
    });

    it('does not throw when the vehicle has no cards', async () => {
      mockMaintenanceCardRepository.delete.mockResolvedValue(null);

      await expect(service.deleteCardsByVehicleId(vehicleId)).resolves.toBeUndefined();
    });
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

```bash
cd backend && pnpm exec vitest run src/modules/maintenance-card/services/maintenance-card.service.spec.ts
```

Expected: FAIL — `MaintenanceCardService` not found.

- [x] **Step 3: Create `MaintenanceCardService`**

Create `backend/src/modules/maintenance-card/services/maintenance-card.service.ts`:

```typescript
import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  MaintenanceCardEntity,
  MaintenanceCardType,
} from 'src/db/entities/maintenance-card.entity';
import { VehicleService } from 'src/modules/vehicle/services/vehicle.service';
import { MaintenanceCardRepository } from '../repositories/maintenance-card.repository';

export type CreateCardInput = {
  type: MaintenanceCardType;
  name: string;
  description: string | null;
  intervalMileage: number | null;
  intervalTimeMonths: number | null;
};

export type UpdateCardInput = {
  type?: MaintenanceCardType;
  name?: string;
  description?: string | null;
  intervalMileage?: number | null;
  intervalTimeMonths?: number | null;
};

// At least one interval required — validated in createCard
function assertAtLeastOneInterval(input: {
  intervalMileage?: number | null;
  intervalTimeMonths?: number | null;
}): void {
  if (input.intervalMileage == null && input.intervalTimeMonths == null) {
    throw new BadRequestException(
      'At least one of intervalMileage or intervalTimeMonths must be set',
    );
  }
}

function sortByUrgency(
  cards: MaintenanceCardEntity[],
  vehicleMileage: number,
): MaintenanceCardEntity[] {
  const today = new Date();

  const isDateOverdue = (card: MaintenanceCardEntity): boolean =>
    card.nextDueDate !== null && new Date(card.nextDueDate) < today;

  const isMileageOverdue = (card: MaintenanceCardEntity): boolean =>
    card.nextDueMileage !== null && card.nextDueMileage < vehicleMileage;

  const isOverdue = (card: MaintenanceCardEntity): boolean =>
    isDateOverdue(card) || isMileageOverdue(card);

  const overdueByDate = cards
    .filter((c) => isDateOverdue(c))
    .sort(
      (a, b) =>
        new Date(a.nextDueDate!).getTime() - new Date(b.nextDueDate!).getTime(),
    );

  const overdueByMileageOnly = cards
    .filter((c) => !isDateOverdue(c) && isMileageOverdue(c))
    .sort((a, b) => (a.nextDueMileage ?? 0) - (b.nextDueMileage ?? 0));

  const nonOverdue = cards
    .filter((c) => !isOverdue(c) && (c.nextDueDate !== null || c.nextDueMileage !== null))
    .sort((a, b) => {
      if (a.nextDueDate && b.nextDueDate) {
        return (
          new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime()
        );
      }
      if (a.nextDueDate) return -1;
      if (b.nextDueDate) return 1;
      return (a.nextDueMileage ?? 0) - (b.nextDueMileage ?? 0);
    });

  const noDueInfo = cards.filter(
    (c) => !isOverdue(c) && c.nextDueDate === null && c.nextDueMileage === null,
  );

  return [...overdueByDate, ...overdueByMileageOnly, ...nonOverdue, ...noDueInfo];
}

@Injectable()
export class MaintenanceCardService {
  constructor(
    private readonly cardRepository: MaintenanceCardRepository,
    @Inject(forwardRef(() => VehicleService))
    private readonly vehicleService: VehicleService,
  ) {}

  async listCards(
    vehicleId: string,
    userId: string,
    sort: 'urgency' | 'name',
  ): Promise<MaintenanceCardEntity[]> {
    const vehicle = await this.vehicleService.getVehicle(vehicleId, userId);
    const cards = await this.cardRepository.getAll({ criteria: { vehicleId } });

    if (sort === 'name') {
      return cards.sort((a, b) => a.name.localeCompare(b.name));
    }

    return sortByUrgency(cards, vehicle.mileage);
  }

  async getCard(
    id: string,
    vehicleId: string,
    userId: string,
  ): Promise<MaintenanceCardEntity> {
    await this.vehicleService.getVehicle(vehicleId, userId);
    const card = await this.cardRepository.getOne({ criteria: { id, vehicleId } });
    if (!card) throw new NotFoundException('Maintenance card not found');
    return card;
  }

  async createCard(
    vehicleId: string,
    userId: string,
    input: CreateCardInput,
  ): Promise<MaintenanceCardEntity> {
    assertAtLeastOneInterval(input);
    await this.vehicleService.getVehicle(vehicleId, userId);
    return this.cardRepository.create({
      creationData: { vehicleId, ...input },
    });
  }

  async updateCard(
    id: string,
    vehicleId: string,
    userId: string,
    input: UpdateCardInput,
  ): Promise<MaintenanceCardEntity> {
    const card = await this.getCard(id, vehicleId, userId);
    Object.assign(card, input);
    assertAtLeastOneInterval(card);
    const [updated] = await this.cardRepository.updateWithSave({ dataArray: [card] });
    return updated;
  }

  async deleteCard(
    id: string,
    vehicleId: string,
    userId: string,
  ): Promise<void> {
    await this.getCard(id, vehicleId, userId);
    await this.cardRepository.delete({ criteria: { id, vehicleId } });
  }

  async deleteCardsByVehicleId(vehicleId: string): Promise<void> {
    await this.cardRepository.delete({ criteria: { vehicleId } });
  }
}
```

- [x] **Step 4: Run the test to verify it passes**

```bash
cd backend && pnpm exec vitest run src/modules/maintenance-card/services/maintenance-card.service.spec.ts
```

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add backend/src/modules/maintenance-card/services/
git commit -m "feat: add MaintenanceCardService with urgency sort"
```

---

### Task 4: Create `MaintenanceCardController`

**Files:**
- Create: `backend/src/modules/maintenance-card/dtos/create-maintenance-card.dto.ts`
- Create: `backend/src/modules/maintenance-card/dtos/update-maintenance-card.dto.ts`
- Create: `backend/src/modules/maintenance-card/controllers/maintenance-card.controller.ts`
- Create: `backend/src/modules/maintenance-card/controllers/maintenance-card.controller.spec.ts`

- [x] **Step 1: Create request body DTOs**

Create `backend/src/modules/maintenance-card/dtos/create-maintenance-card.dto.ts`:

```typescript
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  ICreateMaintenanceCardReqDTO,
  MaintenanceCardType,
} from '@project/types';

export class CreateMaintenanceCardDto implements ICreateMaintenanceCardReqDTO {
  @IsEnum(['task', 'part', 'item'])
  type: MaintenanceCardType;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  // @ValidateIf skips @IsNumber/@Min when null is sent, allowing null to clear the field.
  // The service enforces the at-least-one-interval constraint after both fields are resolved.
  @IsOptional()
  @ValidateIf((o: CreateMaintenanceCardDto) => o.intervalMileage !== null)
  @IsNumber()
  @Min(1)
  intervalMileage?: number | null;

  @IsOptional()
  @ValidateIf((o: CreateMaintenanceCardDto) => o.intervalTimeMonths !== null)
  @IsNumber()
  @Min(1)
  intervalTimeMonths?: number | null;
}
```

Create `backend/src/modules/maintenance-card/dtos/update-maintenance-card.dto.ts`:

```typescript
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  IUpdateMaintenanceCardReqDTO,
  MaintenanceCardType,
} from '@project/types';

export class UpdateMaintenanceCardDto implements IUpdateMaintenanceCardReqDTO {
  @IsOptional()
  @IsEnum(['task', 'part', 'item'])
  type?: MaintenanceCardType;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  // @IsOptional() skips all validators when value is null or undefined (class-validator behaviour)
  // Sending null explicitly clears the field; the service enforces at-least-one-interval constraint.
  @IsOptional()
  @ValidateIf((o: UpdateMaintenanceCardDto) => o.intervalMileage !== null)
  @IsNumber()
  @Min(1)
  intervalMileage?: number | null;

  @IsOptional()
  @ValidateIf((o: UpdateMaintenanceCardDto) => o.intervalTimeMonths !== null)
  @IsNumber()
  @Min(1)
  intervalTimeMonths?: number | null;
}
```

- [x] **Step 2: Write the failing controller test**

Create `backend/src/modules/maintenance-card/controllers/maintenance-card.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MaintenanceCardController } from './maintenance-card.controller';
import { MaintenanceCardService } from '../services/maintenance-card.service';
import { MaintenanceCardType } from 'src/db/entities/maintenance-card.entity';
import { IAuthUser } from '@project/types';

const mockMaintenanceCardService = {
  listCards: vi.fn(),
  getCard: vi.fn(),
  createCard: vi.fn(),
  updateCard: vi.fn(),
  deleteCard: vi.fn(),
};

const authUser: IAuthUser = {
  id: 'user-1',
  email: 'user@example.com',
  firebaseUid: 'uid-1',
};

const baseCard = {
  id: 'card-1',
  vehicleId: 'vehicle-1',
  type: MaintenanceCardType.TASK,
  name: 'CVT Cleaning',
  description: null,
  intervalMileage: 6000,
  intervalTimeMonths: 6,
  nextDueMileage: 12000,
  nextDueDate: new Date('2026-09-01'),
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

describe('MaintenanceCardController', () => {
  let controller: MaintenanceCardController;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MaintenanceCardController],
      providers: [
        { provide: MaintenanceCardService, useValue: mockMaintenanceCardService },
      ],
    }).compile();

    controller = module.get<MaintenanceCardController>(MaintenanceCardController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('GET /vehicles/:vehicleId/maintenance-cards returns list', async () => {
    mockMaintenanceCardService.listCards.mockResolvedValue([baseCard]);
    const result = await controller.list('vehicle-1', 'name', authUser);
    expect(result).toHaveLength(1);
    expect(typeof result[0].createdAt).toBe('string');
    expect(typeof result[0].updatedAt).toBe('string');
  });

  it('GET /vehicles/:vehicleId/maintenance-cards/:id returns single card', async () => {
    mockMaintenanceCardService.getCard.mockResolvedValue(baseCard);
    const result = await controller.getOne('vehicle-1', 'card-1', authUser);
    expect(result.id).toBe('card-1');
    expect(typeof result.createdAt).toBe('string');
  });

  it('POST /vehicles/:vehicleId/maintenance-cards creates card', async () => {
    mockMaintenanceCardService.createCard.mockResolvedValue(baseCard);
    const result = await controller.create(
      'vehicle-1',
      {
        type: 'task',
        name: 'CVT Cleaning',
        intervalMileage: 6000,
        intervalTimeMonths: 6,
      },
      authUser,
    );
    expect(result.id).toBe('card-1');
  });

  it('PATCH /vehicles/:vehicleId/maintenance-cards/:id updates card', async () => {
    const updated = { ...baseCard, name: 'Updated' };
    mockMaintenanceCardService.updateCard.mockResolvedValue(updated);
    const result = await controller.update('vehicle-1', 'card-1', { name: 'Updated' }, authUser);
    expect(result.name).toBe('Updated');
  });

  it('DELETE /vehicles/:vehicleId/maintenance-cards/:id returns 204', async () => {
    mockMaintenanceCardService.deleteCard.mockResolvedValue(undefined);
    await expect(
      controller.delete('vehicle-1', 'card-1', authUser),
    ).resolves.toBeUndefined();
  });
});
```

- [x] **Step 3: Run the test to verify it fails**

```bash
cd backend && pnpm exec vitest run src/modules/maintenance-card/controllers/maintenance-card.controller.spec.ts
```

Expected: FAIL — `MaintenanceCardController` not found.

- [x] **Step 4: Create `MaintenanceCardController`**

Create `backend/src/modules/maintenance-card/controllers/maintenance-card.controller.ts`:

```typescript
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
  Query,
} from '@nestjs/common';
import { IAuthUser, IMaintenanceCardResDTO } from '@project/types';
import { CurrentUser } from 'src/modules/auth/decorators/current-user.decorator';
import { MaintenanceCardEntity } from 'src/db/entities/maintenance-card.entity';
import { MaintenanceCardService } from '../services/maintenance-card.service';
import { CreateMaintenanceCardDto } from '../dtos/create-maintenance-card.dto';
import { UpdateMaintenanceCardDto } from '../dtos/update-maintenance-card.dto';

function toResDTO(card: MaintenanceCardEntity): IMaintenanceCardResDTO {
  return {
    id: card.id,
    vehicleId: card.vehicleId,
    type: card.type,
    name: card.name,
    description: card.description,
    intervalMileage: card.intervalMileage,
    intervalTimeMonths: card.intervalTimeMonths,
    nextDueMileage: card.nextDueMileage,
    nextDueDate: card.nextDueDate ? new Date(card.nextDueDate).toISOString() : null,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  };
}

@Controller('vehicles/:vehicleId/maintenance-cards')
export class MaintenanceCardController {
  constructor(private readonly cardService: MaintenanceCardService) {}

  @Get()
  async list(
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Query('sort') sort: string,
    @CurrentUser() user: IAuthUser,
  ): Promise<IMaintenanceCardResDTO[]> {
    const sortKey = sort === 'urgency' ? 'urgency' : 'name';
    const cards = await this.cardService.listCards(vehicleId, user.id, sortKey);
    return cards.map(toResDTO);
  }

  @Get(':id')
  async getOne(
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IAuthUser,
  ): Promise<IMaintenanceCardResDTO> {
    const card = await this.cardService.getCard(id, vehicleId, user.id);
    return toResDTO(card);
  }

  @Post()
  async create(
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Body() dto: CreateMaintenanceCardDto,
    @CurrentUser() user: IAuthUser,
  ): Promise<IMaintenanceCardResDTO> {
    const card = await this.cardService.createCard(vehicleId, user.id, {
      type: dto.type,
      name: dto.name,
      description: dto.description ?? null,
      intervalMileage: dto.intervalMileage ?? null,
      intervalTimeMonths: dto.intervalTimeMonths ?? null,
    });
    return toResDTO(card);
  }

  @Patch(':id')
  async update(
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMaintenanceCardDto,
    @CurrentUser() user: IAuthUser,
  ): Promise<IMaintenanceCardResDTO> {
    const card = await this.cardService.updateCard(id, vehicleId, user.id, dto);
    return toResDTO(card);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IAuthUser,
  ): Promise<void> {
    await this.cardService.deleteCard(id, vehicleId, user.id);
  }
}
```

- [x] **Step 5: Run the test to verify it passes**

```bash
cd backend && pnpm exec vitest run src/modules/maintenance-card/controllers/maintenance-card.controller.spec.ts
```

Expected: PASS

- [x] **Step 6: Commit**

```bash
git add backend/src/modules/maintenance-card/dtos/ \
        backend/src/modules/maintenance-card/controllers/
git commit -m "feat: add MaintenanceCardController with DTOs"
```

---

## Chunk 3: Vehicle Delete Cascade + Module Registration

### Task 5: Complete Vehicle delete cascade

> **Note:** This task was initially implemented as described (via `MaintenanceCardService.deleteCardsByVehicleId`), then superseded by code-review-fixes-005 which replaced the service-call cascade with a TypeORM `@OneToMany(cascade: ['soft-remove'])` relation, eliminating the circular dependency. Final implementation uses `vehicleRepository.delete({ relation: { maintenanceCards: true } })`.

**Files:**
- Modify: `backend/src/modules/vehicle/services/vehicle.service.ts`
- Modify: `backend/src/modules/vehicle/services/vehicle.service.spec.ts`
- Modify: `backend/src/modules/vehicle/vehicle.module.ts`

Now that `MaintenanceCardService` exists, extend `VehicleService.deleteVehicle` to cascade.

- [x] **Step 1: Add cascade test to `vehicle.service.spec.ts`**

In `backend/src/modules/vehicle/services/vehicle.service.spec.ts`, add `MaintenanceCardService` mock and cascade test:

Add to the existing mock declarations at the top:
```typescript
const mockMaintenanceCardService = {
  deleteCardsByVehicleId: vi.fn(),
};
```

Add `MaintenanceCardService` to the `TestingModule` providers:
```typescript
{ provide: MaintenanceCardService, useValue: mockMaintenanceCardService },
```

Add import at the top of the file:
```typescript
import { MaintenanceCardService } from 'src/modules/maintenance-card/services/maintenance-card.service';
```

Add the new test case inside `describe('#deleteVehicle')`:
```typescript
it('deletes all maintenance cards before soft-deleting the vehicle', async () => {
  mockVehicleRepository.getOne.mockResolvedValue(baseVehicle);
  mockVehicleRepository.delete.mockResolvedValue([baseVehicle]);
  mockMaintenanceCardService.deleteCardsByVehicleId.mockResolvedValue(undefined);

  await service.deleteVehicle(vehicleId, userId);

  expect(mockMaintenanceCardService.deleteCardsByVehicleId).toHaveBeenCalledWith(vehicleId);
  expect(mockVehicleRepository.delete).toHaveBeenCalled();
});
```

- [x] **Step 2: Run the test to verify it fails**

```bash
cd backend && pnpm exec vitest run src/modules/vehicle/services/vehicle.service.spec.ts
```

Expected: FAIL — `MaintenanceCardService` import error or cascade test fails.

- [x] **Step 3: Update `VehicleService` to inject `MaintenanceCardService` and cascade**

In `backend/src/modules/vehicle/services/vehicle.service.ts`:

Add import:
```typescript
import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MaintenanceCardService } from 'src/modules/maintenance-card/services/maintenance-card.service';
```

Update the constructor:
```typescript
constructor(
  private readonly vehicleRepository: VehicleRepository,
  @Inject(forwardRef(() => MaintenanceCardService))
  private readonly maintenanceCardService: MaintenanceCardService,
) {}
```

Update `deleteVehicle`:
```typescript
async deleteVehicle(id: string, userId: string): Promise<void> {
  await this.getVehicle(id, userId);
  await this.maintenanceCardService.deleteCardsByVehicleId(id);
  await this.vehicleRepository.delete({ criteria: { id, userId } });
}
```

- [x] **Step 4: Run the test to verify it passes**

```bash
cd backend && pnpm exec vitest run src/modules/vehicle/services/vehicle.service.spec.ts
```

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add backend/src/modules/vehicle/services/vehicle.service.ts \
        backend/src/modules/vehicle/services/vehicle.service.spec.ts
git commit -m "feat: cascade soft-delete maintenance cards on vehicle delete"
```

---

### Task 6: Create `MaintenanceCardModule` and register

**Files:**
- Create: `backend/src/modules/maintenance-card/maintenance-card.module.ts`
- Modify: `backend/src/modules/vehicle/vehicle.module.ts`
- Modify: `backend/src/modules/app/app.module.ts`

- [x] **Step 1: Create `MaintenanceCardModule`**

Create `backend/src/modules/maintenance-card/maintenance-card.module.ts`:

```typescript
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaintenanceCardEntity } from 'src/db/entities/maintenance-card.entity';
import { VehicleModule } from '../vehicle/vehicle.module';
import { MaintenanceCardRepository } from './repositories/maintenance-card.repository';
import { MaintenanceCardService } from './services/maintenance-card.service';
import { MaintenanceCardController } from './controllers/maintenance-card.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([MaintenanceCardEntity]),
    forwardRef(() => VehicleModule),
  ],
  providers: [MaintenanceCardRepository, MaintenanceCardService],
  controllers: [MaintenanceCardController],
  exports: [MaintenanceCardService],
})
export class MaintenanceCardModule {}
```

- [x] **Step 2: Update `VehicleModule` to use `forwardRef` and export `VehicleService`**

In `backend/src/modules/vehicle/vehicle.module.ts`, update to:
```typescript
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleEntity } from 'src/db/entities/vehicle.entity';
import { MaintenanceCardModule } from '../maintenance-card/maintenance-card.module';
import { VehicleRepository } from './repositories/vehicle.repository';
import { VehicleService } from './services/vehicle.service';
import { VehicleController } from './controllers/vehicle.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([VehicleEntity]),
    forwardRef(() => MaintenanceCardModule),
  ],
  providers: [VehicleRepository, VehicleService],
  controllers: [VehicleController],
  exports: [VehicleService],
})
export class VehicleModule {}
```

- [x] **Step 3: Add `MaintenanceCardModule` to `AppModule` imports**

In `backend/src/modules/app/app.module.ts`, add the import statement:

```typescript
import { MaintenanceCardModule } from '../maintenance-card/maintenance-card.module';
```

Add `MaintenanceCardModule` to the `imports` array. Do not replace the file — only add the new import.

- [x] **Step 4: Run all unit tests**

```bash
just test-unit
```

Expected: All tests pass.

- [x] **Step 5: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [x] **Step 6: Smoke test** _(not verified — requires running Docker services)_

Start services (`just up-build`), obtain a Firebase token, then:

```bash
# Create a vehicle
VEHICLE=$(curl -s -X POST http://localhost:3001/vehicles \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"brand":"Honda","model":"PCX","colour":"White","mileage":10000,"mileageUnit":"km"}')
VEHICLE_ID=$(echo $VEHICLE | jq -r '.id')

# Create a maintenance card
curl -s -X POST "http://localhost:3001/vehicles/$VEHICLE_ID/maintenance-cards" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"type":"task","name":"CVT Cleaning","intervalMileage":6000,"intervalTimeMonths":6}' | jq

# List cards (default sort=name)
curl -s "http://localhost:3001/vehicles/$VEHICLE_ID/maintenance-cards" \
  -H "Authorization: Bearer <token>" | jq

# List cards sort by urgency
curl -s "http://localhost:3001/vehicles/$VEHICLE_ID/maintenance-cards?sort=urgency" \
  -H "Authorization: Bearer <token>" | jq
```

Expected: 201 on create, 200 with card list on list.

- [x] **Step 7: Commit**

```bash
git add backend/src/modules/maintenance-card/ \
        backend/src/modules/vehicle/ \
        backend/src/modules/app/app.module.ts
git commit -m "feat: implement MaintenanceCard CRUD API and Vehicle delete cascade"
```
