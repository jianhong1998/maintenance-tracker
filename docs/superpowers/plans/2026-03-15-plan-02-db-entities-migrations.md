# Plan 02: DB Entities & Migrations

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create all five TypeORM entities (User, Vehicle, MaintenanceCard, MaintenanceHistory, BackgroundJob), register them, generate a single migration, and verify it runs cleanly against the database.

**Architecture:** Each entity lives in its own file under `backend/src/db/entities/`. All entities are registered in `backend/src/db/entity-model.ts`. One migration is generated covering all tables. No services or controllers are created in this plan.

**Tech Stack:** TypeORM, PostgreSQL, NestJS

**Spec reference:** `docs/superpowers/specs/2026-03-14-maintenance-tracker-design.md` — Section 3 (Data Model)

**Prerequisite:** Plan 01 must be complete (Docker services running, packages installed).

---

## Chunk 1: Entity Files

### Task 1: Create decimal transformer utility

**Files:**
- Create: `backend/src/db/transformers/decimal.transformer.ts`

TypeORM returns PostgreSQL `decimal`/`numeric` columns as **strings** at runtime. Use this transformer on every `decimal` column to ensure TypeScript types match runtime values.

- [ ] **Step 1: Create the transformer file**

Create `backend/src/db/transformers/decimal.transformer.ts`:

```typescript
import { ValueTransformer } from 'typeorm';

export const decimalTransformer: ValueTransformer = {
  to: (value: number | null): number | null => value,
  from: (value: string | null): number | null =>
    value === null ? null : parseFloat(value),
};
```

---

### Task 2: Create `User` entity

**Files:**
- Create: `backend/src/db/entities/user.entity.ts`

- [ ] **Step 1: Create the entity file**

Create `backend/src/db/entities/user.entity.ts`:

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  email: string;

  @Column({ type: 'varchar', unique: true, name: 'firebase_uid' })
  firebaseUid: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

---

### Task 3: Create `Vehicle` entity

**Files:**
- Create: `backend/src/db/entities/vehicle.entity.ts`

- [ ] **Step 1: Create the entity file**

Create `backend/src/db/entities/vehicle.entity.ts`:

```typescript
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { decimalTransformer } from '../transformers/decimal.transformer';

export enum MileageUnit {
  KM = 'km',
  MILE = 'mile',
}

@Entity('vehicles')
export class VehicleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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
    enum: MileageUnit,
    name: 'mileage_unit',
    default: MileageUnit.KM,
  })
  mileageUnit: MileageUnit;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date | null;
}
```

---

### Task 4: Create `MaintenanceCard` entity

**Files:**
- Create: `backend/src/db/entities/maintenance-card.entity.ts`

- [ ] **Step 1: Create the entity file**

Create `backend/src/db/entities/maintenance-card.entity.ts`:

```typescript
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { VehicleEntity } from './vehicle.entity';
import { decimalTransformer } from '../transformers/decimal.transformer';

export enum MaintenanceCardType {
  TASK = 'task',
  PART = 'part',
  ITEM = 'item',
}

@Entity('maintenance_cards')
export class MaintenanceCardEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'vehicle_id' })
  vehicleId: string;

  @ManyToOne(() => VehicleEntity)
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: VehicleEntity;

  @Column({ type: 'enum', enum: MaintenanceCardType })
  type: MaintenanceCardType;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    name: 'interval_mileage',
    transformer: decimalTransformer,
  })
  intervalMileage: number | null;

  @Column({ type: 'int', nullable: true, name: 'interval_time_months' })
  intervalTimeMonths: number | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    name: 'next_due_mileage',
    transformer: decimalTransformer,
  })
  nextDueMileage: number | null;

  @Column({ type: 'date', nullable: true, name: 'next_due_date' })
  nextDueDate: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date | null;
}
```

---

### Task 5: Create `MaintenanceHistory` entity

**Files:**
- Create: `backend/src/db/entities/maintenance-history.entity.ts`

- [ ] **Step 1: Create the entity file**

Create `backend/src/db/entities/maintenance-history.entity.ts`:

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MaintenanceCardEntity } from './maintenance-card.entity';
import { decimalTransformer } from '../transformers/decimal.transformer';

@Entity('maintenance_histories')
export class MaintenanceHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'maintenance_card_id' })
  maintenanceCardId: string;

  @ManyToOne(() => MaintenanceCardEntity)
  @JoinColumn({ name: 'maintenance_card_id' })
  maintenanceCard: MaintenanceCardEntity;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    name: 'done_at_mileage',
    transformer: decimalTransformer,
  })
  doneAtMileage: number | null;

  @Column({ type: 'date', name: 'done_at_date' })
  doneAtDate: Date;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

---

### Task 6: Create `BackgroundJob` entity

**Files:**
- Create: `backend/src/db/entities/background-job.entity.ts`

- [ ] **Step 1: Create the entity file**

Create `backend/src/db/entities/background-job.entity.ts`:

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum BackgroundJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  DONE = 'done',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('background_jobs')
export class BackgroundJobEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', name: 'job_type' })
  jobType: string;

  @Column({ type: 'uuid', nullable: true, name: 'reference_id' })
  referenceId: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'reference_type' })
  referenceType: string | null;

  @Column({ type: 'varchar', unique: true, name: 'idempotency_key' })
  idempotencyKey: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: BackgroundJobStatus,
    default: BackgroundJobStatus.PENDING,
  })
  status: BackgroundJobStatus;

  @Column({ type: 'timestamptz', name: 'scheduled_from' })
  scheduledFrom: Date;

  @Column({ type: 'timestamptz' })
  ttl: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_attempted_at' })
  lastAttemptedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

---

## Chunk 2: Register Entities & Generate Migration

### Task 7: Register all entities and generate migration

**Files:**
- Modify: `backend/src/db/entity-model.ts`

- [ ] **Step 1: Register all entities in `entity-model.ts`**

Replace the content of `backend/src/db/entity-model.ts`:

```typescript
import { BackgroundJobEntity } from './entities/background-job.entity';
import { MaintenanceCardEntity } from './entities/maintenance-card.entity';
import { MaintenanceHistoryEntity } from './entities/maintenance-history.entity';
import { UserEntity } from './entities/user.entity';
import { VehicleEntity } from './entities/vehicle.entity';

export const ENTITY_MODELS = [
  UserEntity,
  VehicleEntity,
  MaintenanceCardEntity,
  MaintenanceHistoryEntity,
  BackgroundJobEntity,
];

export type ModelConstructorType = (typeof ENTITY_MODELS)[number];
```

- [ ] **Step 2: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [ ] **Step 3: Start services (if not already running)**

```bash
just up-build
```

Expected: postgres, redis, server, and client services all healthy.

- [ ] **Step 4: Build the backend to produce `dist/` for the migration CLI**

The TypeORM migration CLI uses the compiled `dist/` output. Run:

```bash
cd backend && pnpm run build
```

Expected: `dist/` directory is created/updated with no TypeScript errors.

- [ ] **Step 5: Generate the migration**

```bash
cd backend && pnpm run migration:generate --name=InitialSchema
```

Expected: A new file is created at `backend/src/db/migrations/<timestamp>-InitialSchema.ts` containing `CREATE TABLE` statements for all 5 tables.

Verify the migration file contains all expected tables:
- `users`
- `vehicles`
- `maintenance_cards`
- `maintenance_histories`
- `background_jobs`

- [ ] **Step 6: Verify migration runs cleanly**

```bash
cd backend && pnpm run migration:run
```

Expected: Output shows the `InitialSchema` migration executed successfully with no errors.

- [ ] **Step 7: Verify tables exist in the database**

```bash
docker exec -it maintenance-tracker-postgres-1 psql -U postgres -d project_db -c "\dt"
```

Expected output includes:
```
 public | background_jobs        | table | postgres
 public | maintenance_cards      | table | postgres
 public | maintenance_histories  | table | postgres
 public | users                  | table | postgres
 public | vehicles               | table | postgres
```

- [ ] **Step 8: Run all unit tests to confirm nothing is broken**

```bash
just test-unit
```

Expected: All tests pass.

- [ ] **Step 9: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [ ] **Step 10: Commit**

```bash
git add backend/src/db/
git commit -m "feat: add all TypeORM entities and generate initial schema migration"
```
