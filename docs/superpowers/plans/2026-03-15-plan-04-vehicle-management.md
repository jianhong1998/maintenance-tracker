# Plan 04: Vehicle Management

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full Vehicle CRUD API — list, create, get, update, soft delete — with ownership enforcement (users can only access their own vehicles).

**Architecture:** `VehicleModule` contains a `VehicleRepository` (extends `BaseDBUtil`), `VehicleService` (business logic + ownership checks), and `VehicleController` (HTTP endpoints). Shared DTOs live in `@project/types`. All endpoints are protected by the global `FirebaseAuthGuard` (from Plan 03). Ownership violations return 404.

**Tech Stack:** NestJS, TypeORM (`VehicleEntity`), `class-validator`, `@project/types`

**Spec reference:** `docs/superpowers/specs/2026-03-14-maintenance-tracker-design.md` — Section 4 (Vehicles API), Section 7 (Soft Delete Cascade)

**Prerequisites:** Plans 01–03 must be complete. `VehicleEntity` and its migration were created in Plan 02.

**API convention:** All request and response fields use camelCase (e.g. `mileageUnit`, not `mileage_unit`). This is consistent with the existing codebase pattern.

**Cascade note:** Spec Section 7 requires that deleting a Vehicle also soft-deletes all its `MaintenanceCard` records and cancels their `BackgroundJob` records. The `MaintenanceCardRepository` and `BackgroundJobRepository` do not exist yet. The cascade will be completed in Plan 05 (Maintenance Card Management). The `deleteVehicle` method in this plan performs the vehicle soft-delete only; Plan 05 will extend it with the full cascade.

---

## Chunk 1: Shared Types

### Task 1: Add Vehicle DTOs to `@project/types`

**Files:**
- Create: `packages/types/src/dtos/vehicle.dto.ts`
- Modify: `packages/types/src/dtos/index.ts`

- [x] **Step 1: Create `vehicle.dto.ts`**

Create `packages/types/src/dtos/vehicle.dto.ts`:

```typescript
export type MileageUnit = 'km' | 'mile';

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

export interface IVehicleResDTO {
  id: string;
  brand: string;
  model: string;
  colour: string;
  mileage: number;
  mileageUnit: MileageUnit;
  createdAt: string;
  updatedAt: string;
}
```

- [x] **Step 2: Re-export from `packages/types/src/dtos/index.ts`**

Add to `packages/types/src/dtos/index.ts`:

```typescript
export * from './vehicle.dto';
```

- [x] **Step 3: Build `@project/types`**

```bash
cd packages/types && pnpm run build
```

Expected: No TypeScript errors.

- [x] **Step 4: Commit**

```bash
git add packages/types/src/dtos/vehicle.dto.ts packages/types/src/dtos/index.ts
git commit -m "feat: add Vehicle DTOs to shared types"
```

---

## Chunk 2: VehicleModule

### Task 2: Create `VehicleRepository`

**Files:**
- Create: `backend/src/modules/vehicle/repositories/vehicle.repository.ts`
- Create: `backend/src/modules/vehicle/repositories/vehicle.repository.spec.ts`

- [x] **Step 1: Write the failing test**

Create `backend/src/modules/vehicle/repositories/vehicle.repository.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { VehicleRepository } from './vehicle.repository';
import { VehicleEntity, MileageUnit } from 'src/db/entities/vehicle.entity';

const mockTypeOrmRepo = {
  create: vi.fn(),
  save: vi.fn(),
};

describe('VehicleRepository', () => {
  let repository: VehicleRepository;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VehicleRepository,
        { provide: getRepositoryToken(VehicleEntity), useValue: mockTypeOrmRepo },
      ],
    }).compile();

    repository = module.get<VehicleRepository>(VehicleRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('#create', () => {
    it('creates and saves a new vehicle', async () => {
      const newVehicle = {
        id: 'vehicle-1',
        userId: 'user-1',
        brand: 'Honda',
        model: 'PCX',
        colour: 'White',
        mileage: 1000,
        mileageUnit: MileageUnit.KM,
      } as VehicleEntity;

      mockTypeOrmRepo.create.mockReturnValue(newVehicle);
      mockTypeOrmRepo.save.mockResolvedValue(newVehicle);

      const result = await repository.create({
        creationData: {
          userId: 'user-1',
          brand: 'Honda',
          model: 'PCX',
          colour: 'White',
          mileage: 1000,
          mileageUnit: MileageUnit.KM,
        },
      });

      expect(result).toEqual(newVehicle);
    });
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

```bash
cd backend && pnpm exec vitest run src/modules/vehicle/repositories/vehicle.repository.spec.ts
```

Expected: FAIL — `VehicleRepository` not found.

- [x] **Step 3: Create `VehicleRepository`**

Create `backend/src/modules/vehicle/repositories/vehicle.repository.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { VehicleEntity, MileageUnit } from 'src/db/entities/vehicle.entity';
import { BaseDBUtil } from 'src/modules/common/base-classes/base-db-util';

export type CreateVehicleData = {
  userId: string;
  brand: string;
  model: string;
  colour: string;
  mileage: number;
  mileageUnit: MileageUnit;
};

@Injectable()
export class VehicleRepository extends BaseDBUtil<VehicleEntity, CreateVehicleData> {
  constructor(
    @InjectRepository(VehicleEntity)
    private readonly vehicleRepo: Repository<VehicleEntity>,
  ) {
    super(VehicleEntity, vehicleRepo);
  }

  async create(params: {
    creationData: CreateVehicleData;
    entityManager?: EntityManager;
  }): Promise<VehicleEntity> {
    const { creationData, entityManager } = params;
    const repo =
      (entityManager?.getRepository(VehicleEntity) as Repository<VehicleEntity>) ??
      this.vehicleRepo;

    const vehicle = repo.create(creationData);
    return await repo.save(vehicle);
  }
}
```

- [x] **Step 4: Run the test to verify it passes**

```bash
cd backend && pnpm exec vitest run src/modules/vehicle/repositories/vehicle.repository.spec.ts
```

Expected: PASS

---

### Task 3: Create `VehicleService`

**Files:**
- Create: `backend/src/modules/vehicle/services/vehicle.service.ts`
- Create: `backend/src/modules/vehicle/services/vehicle.service.spec.ts`

- [x] **Step 1: Write the failing test**

Create `backend/src/modules/vehicle/services/vehicle.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { VehicleService } from './vehicle.service';
import { VehicleRepository } from '../repositories/vehicle.repository';
import { MileageUnit } from 'src/db/entities/vehicle.entity';

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
  mileageUnit: MileageUnit.KM,
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
        mileageUnit: MileageUnit.KM,
      });

      expect(result).toEqual(baseVehicle);
    });
  });

  describe('#updateVehicle', () => {
    it('updates and returns the vehicle with patched fields applied', async () => {
      const updated = { ...baseVehicle, colour: 'Black' };
      mockVehicleRepository.getOne.mockResolvedValue(baseVehicle);
      mockVehicleRepository.updateWithSave.mockResolvedValue([updated]);

      const result = await service.updateVehicle(vehicleId, userId, { colour: 'Black' });

      // Verify Object.assign applied the patch before calling the repository
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
    it('soft deletes the vehicle when it belongs to the user', async () => {
      mockVehicleRepository.getOne.mockResolvedValue(baseVehicle);
      mockVehicleRepository.delete.mockResolvedValue([baseVehicle]);

      await service.deleteVehicle(vehicleId, userId);

      expect(mockVehicleRepository.delete).toHaveBeenCalledWith({
        criteria: { id: vehicleId, userId },
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

- [x] **Step 2: Run the test to verify it fails**

```bash
cd backend && pnpm exec vitest run src/modules/vehicle/services/vehicle.service.spec.ts
```

Expected: FAIL — `VehicleService` not found.

- [x] **Step 3: Create `VehicleService`**

Create `backend/src/modules/vehicle/services/vehicle.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { VehicleEntity, MileageUnit } from 'src/db/entities/vehicle.entity';
import { VehicleRepository } from '../repositories/vehicle.repository';

export type CreateVehicleInput = {
  brand: string;
  model: string;
  colour: string;
  mileage: number;
  mileageUnit: MileageUnit;
};

export type UpdateVehicleInput = {
  brand?: string;
  model?: string;
  colour?: string;
  mileage?: number;
  mileageUnit?: MileageUnit;
};

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
    input: CreateVehicleInput,
  ): Promise<VehicleEntity> {
    return this.vehicleRepository.create({
      creationData: { userId, ...input },
    });
  }

  async updateVehicle(
    id: string,
    userId: string,
    input: UpdateVehicleInput,
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
    await this.vehicleRepository.delete({ criteria: { id, userId } });
  }
}
```

- [x] **Step 4: Run the test to verify it passes**

```bash
cd backend && pnpm exec vitest run src/modules/vehicle/services/vehicle.service.spec.ts
```

Expected: PASS

---

### Task 4: Create `VehicleController`

**Files:**
- Create: `backend/src/modules/vehicle/controllers/vehicle.controller.ts`
- Create: `backend/src/modules/vehicle/controllers/vehicle.controller.spec.ts`

- [x] **Step 1: Create request body DTOs**

Create `backend/src/modules/vehicle/dtos/create-vehicle.dto.ts`:

```typescript
import { IsEnum, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { ICreateVehicleReqDTO, MileageUnit } from '@project/types';

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
  mileage: number;

  @IsEnum(['km', 'mile'])
  mileageUnit: MileageUnit;
}
```

Create `backend/src/modules/vehicle/dtos/update-vehicle.dto.ts`:

```typescript
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { IUpdateVehicleReqDTO, MileageUnit } from '@project/types';

export class UpdateVehicleDto implements IUpdateVehicleReqDTO {
  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  colour?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  mileage?: number;

  @IsOptional()
  @IsEnum(['km', 'mile'])
  mileageUnit?: MileageUnit;
}
```

- [x] **Step 2: Write the failing controller test**

Create `backend/src/modules/vehicle/controllers/vehicle.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { VehicleController } from './vehicle.controller';
import { VehicleService } from '../services/vehicle.service';
import { MileageUnit } from 'src/db/entities/vehicle.entity';
import { IAuthUser } from '@project/types';

const mockVehicleService = {
  listVehicles: vi.fn(),
  getVehicle: vi.fn(),
  createVehicle: vi.fn(),
  updateVehicle: vi.fn(),
  deleteVehicle: vi.fn(),
};

const authUser: IAuthUser = {
  id: 'user-1',
  email: 'user@example.com',
  firebaseUid: 'uid-1',
};

const baseVehicle = {
  id: 'vehicle-1',
  userId: 'user-1',
  brand: 'Honda',
  model: 'PCX',
  colour: 'White',
  mileage: 1000,
  mileageUnit: MileageUnit.KM,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

describe('VehicleController', () => {
  let controller: VehicleController;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VehicleController],
      providers: [
        { provide: VehicleService, useValue: mockVehicleService },
      ],
    }).compile();

    controller = module.get<VehicleController>(VehicleController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('GET /vehicles returns list', async () => {
    mockVehicleService.listVehicles.mockResolvedValue([baseVehicle]);
    const result = await controller.list(authUser);
    expect(result).toHaveLength(1);
    expect(mockVehicleService.listVehicles).toHaveBeenCalledWith(authUser.id);
    // Verify toResDTO maps dates to ISO strings
    expect(typeof result[0].createdAt).toBe('string');
    expect(typeof result[0].updatedAt).toBe('string');
  });

  it('GET /vehicles/:id returns vehicle with ISO date strings', async () => {
    mockVehicleService.getVehicle.mockResolvedValue(baseVehicle);
    const result = await controller.getOne('vehicle-1', authUser);
    expect(result.id).toBe('vehicle-1');
    expect(typeof result.createdAt).toBe('string');
    expect(typeof result.updatedAt).toBe('string');
  });

  it('GET /vehicles/:id throws 404 for wrong user', async () => {
    mockVehicleService.getVehicle.mockRejectedValue(new NotFoundException());
    await expect(controller.getOne('vehicle-1', authUser)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('POST /vehicles creates vehicle', async () => {
    mockVehicleService.createVehicle.mockResolvedValue(baseVehicle);
    const result = await controller.create(
      { brand: 'Honda', model: 'PCX', colour: 'White', mileage: 1000, mileageUnit: 'km' },
      authUser,
    );
    expect(result.id).toBe('vehicle-1');
  });

  it('PATCH /vehicles/:id updates vehicle', async () => {
    const updated = { ...baseVehicle, colour: 'Black' };
    mockVehicleService.updateVehicle.mockResolvedValue(updated);
    const result = await controller.update('vehicle-1', { colour: 'Black' }, authUser);
    expect(result.colour).toBe('Black');
  });

  it('DELETE /vehicles/:id returns 204', async () => {
    mockVehicleService.deleteVehicle.mockResolvedValue(undefined);
    await expect(
      controller.delete('vehicle-1', authUser),
    ).resolves.toBeUndefined();
  });
});
```

- [x] **Step 3: Run the test to verify it fails**

```bash
cd backend && pnpm exec vitest run src/modules/vehicle/controllers/vehicle.controller.spec.ts
```

Expected: FAIL — `VehicleController` not found.

- [x] **Step 4: Create `VehicleController`**

Create `backend/src/modules/vehicle/controllers/vehicle.controller.ts`:

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
} from '@nestjs/common';
import { IAuthUser, IVehicleResDTO } from '@project/types';
import { CurrentUser } from 'src/modules/auth/decorators/current-user.decorator';
import { VehicleEntity } from 'src/db/entities/vehicle.entity';
import { VehicleService } from '../services/vehicle.service';
import { CreateVehicleDto } from '../dtos/create-vehicle.dto';
import { UpdateVehicleDto } from '../dtos/update-vehicle.dto';

function toResDTO(vehicle: VehicleEntity): IVehicleResDTO {
  return {
    id: vehicle.id,
    brand: vehicle.brand,
    model: vehicle.model,
    colour: vehicle.colour,
    mileage: vehicle.mileage,
    mileageUnit: vehicle.mileageUnit,
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

- [x] **Step 5: Run the test to verify it passes**

```bash
cd backend && pnpm exec vitest run src/modules/vehicle/controllers/vehicle.controller.spec.ts
```

Expected: PASS

---

### Task 5: Create `VehicleModule` and register

**Files:**
- Create: `backend/src/modules/vehicle/vehicle.module.ts`
- Modify: `backend/src/modules/app/app.module.ts`

- [x] **Step 1: Create `VehicleModule`**

Create `backend/src/modules/vehicle/vehicle.module.ts`:

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
})
export class VehicleModule {}
```

- [x] **Step 2: Add `VehicleModule` to `AppModule` imports**

In `backend/src/modules/app/app.module.ts`, add the import statement:

```typescript
import { VehicleModule } from '../vehicle/vehicle.module';
```

Add `VehicleModule` to the `imports` array. Do not replace the file — only add the new import.

- [x] **Step 3: Run all unit tests**

```bash
just test-unit
```

Expected: All tests pass.

- [x] **Step 4: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [x] **Step 5: Smoke test the API**

Start services (`just up-build`), obtain a Firebase ID token, then run:

```bash
# Create a vehicle
curl -s -X POST http://localhost:3001/vehicles \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"brand":"Honda","model":"PCX","colour":"White","mileage":1000,"mileageUnit":"km"}' | jq

# List vehicles
curl -s http://localhost:3001/vehicles \
  -H "Authorization: Bearer <token>" | jq

# Get by ID (use the id from create response)
curl -s http://localhost:3001/vehicles/<id> \
  -H "Authorization: Bearer <token>" | jq

# Update mileage
curl -s -X PATCH http://localhost:3001/vehicles/<id> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"mileage":1500}' | jq

# Delete
curl -s -o /dev/null -w "%{http_code}" -X DELETE http://localhost:3001/vehicles/<id> \
  -H "Authorization: Bearer <token>"
```

Expected: 201 on create, 200 on list/get/update, 204 on delete.

- [x] **Step 6: Commit**

```bash
git add backend/src/modules/vehicle/ backend/src/modules/app/app.module.ts
git commit -m "feat: implement Vehicle CRUD API with ownership enforcement"
```
