# Plan 02: DB Entities & Migrations

> **Status: COMPLETE** — All tasks implemented and merged. See [Implementation Notes](#implementation-notes) for deviations from the original spec.

**Goal:** Create all five TypeORM entities (User, Vehicle, MaintenanceCard, MaintenanceHistory, BackgroundJob), register them, generate a single migration, and verify it runs cleanly against the database.

**Architecture:** Each entity lives in its own file under `backend/src/db/entities/`. All entities are registered in `backend/src/db/entity-model.ts`. One migration is generated covering all tables. No services or controllers are created in this plan.

**Tech Stack:** TypeORM, PostgreSQL, NestJS

**Spec reference:** `docs/superpowers/specs/2026-03-14-maintenance-tracker-design.md` — Section 3 (Data Model)

**Prerequisite:** Plan 01 must be complete (Docker services running, packages installed).

---

## Implementation Notes

The following deviations from the original spec were made during implementation, driven by code review feedback (PR #7):

### 1. UUIDv7 base entity extracted (`backend/src/db/entities/base.entity.ts`)

**Original plan:** Each entity used `@PrimaryGeneratedColumn('uuid')` directly, generating UUIDv4 via PostgreSQL's `uuid_generate_v4()` function (requires `uuid-ossp` extension).

**Actual implementation:** A shared `UuidV7BaseEntity` abstract class was introduced. It uses `@PrimaryColumn({ type: 'uuid' })` + `@BeforeInsert()` to generate UUIDv7 IDs at the application layer via the `uuidv7` package. All five entities extend `UuidV7BaseEntity` instead of declaring `id` directly.

**Why:** Avoids the `uuid-ossp` PostgreSQL extension dependency. UUIDv7 is also time-sortable, which is better for index locality than random UUIDv4.

### 2. All timestamp columns use `timestamptz`

**Original plan:** `@CreateDateColumn`, `@UpdateDateColumn`, `@DeleteDateColumn` were used with no explicit type (TypeORM defaults to `timestamp without time zone`). `BackgroundJob` used `timestamptz` for its job-specific columns.

**Actual implementation:** All date columns across all entities specify `type: 'timestamptz'` explicitly.

**Why:** Code review flagged timezone inconsistency. Using `timestamptz` everywhere prevents subtle bugs when the server timezone differs from UTC.

### 3. `UserEntity` gained `updatedAt` and `deletedAt`

**Original plan:** `UserEntity` had only `createdAt`.

**Actual implementation:** `UserEntity` also has `@UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })` and `@DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })`.

**Why:** Code review flagged the absence. Users may need to be soft-deleted or have their email updated; without these columns there would be no infrastructure to support that.

### 4. `UserEntity.email` is now unique

**Original plan:** `email` column had no `unique: true`.

**Actual implementation:** `@Column({ type: 'varchar', unique: true })`.

**Why:** Code review flagged missing unique constraint. Two accounts sharing an email would cause silent bugs on any email-based lookup.

### 5. FK columns have `@Index()` decorators

**Original plan:** No indexes on FK columns.

**Actual implementation:** `VehicleEntity.userId`, `MaintenanceCardEntity.vehicleId`, and `MaintenanceHistoryEntity.maintenanceCardId` all carry `@Index()` from TypeORM.

**Why:** PostgreSQL does not auto-create indexes on FK columns. Without them, JOINs and FK lookups do full sequential scans. The `@Index()` decorator also ensures the index survives future `migration:generate` regenerations (the migration was regenerated once without them and the indexes were silently dropped, which the code review caught).

### 6. `MaintenanceHistoryEntity` gained soft-delete

**Original plan:** `MaintenanceHistoryEntity` had only `createdAt` — no `deletedAt`.

**Actual implementation:** `@DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })` added.

**Why:** Code review noted that history records are audit-trail data; hard-deleting them could destroy important records. Soft-delete gives a recovery path.

### 7. `BackgroundJobEntity.ttl` renamed to `expiresAt`

**Original plan:** Column was named `ttl: Date`.

**Actual implementation:** Column is named `expiresAt: Date` with `name: 'expires_at'`.

**Why:** `ttl` (time-to-live) conventionally represents a duration, not a timestamp. `expiresAt` makes the semantic — an absolute expiry timestamp — unambiguous.

### 8. `decimalTransformer` handles `undefined`

**Original plan:** `to` signature was `(value: number | null): number | null`.

**Actual implementation:** `to` signature is `(value: number | null | undefined): number | null | undefined`.

**Why:** TypeORM may call `to` with `undefined` for optional columns not set on an insert. The original types were misleading; the fix aligns TypeScript types with actual runtime behaviour.

### 9. Migration file

The final migration file is `backend/src/db/migrations/1773633630216-init.ts` (not `InitialSchema` as planned — TypeORM generated the name from the `--name=init` flag used on the final regeneration). It correctly includes all five tables, FK constraints, enum types, unique constraints, and FK indexes, with a complete `down()` that reverses in the correct order.

---

## Chunk 1: Entity Files

### Task 1: Create decimal transformer utility

**Files:**
- Create: `backend/src/db/transformers/decimal.transformer.ts`

TypeORM returns PostgreSQL `decimal`/`numeric` columns as **strings** at runtime. Use this transformer on every `decimal` column to ensure TypeScript types match runtime values.

- [x] **Step 1: Create the transformer file**

Actual implementation (updated from plan — `undefined` added to handle optional columns):

```typescript
import { ValueTransformer } from 'typeorm';

export const decimalTransformer: ValueTransformer = {
  to: (value: number | null | undefined): number | null | undefined => value,
  from: (value: string | null): number | null =>
    value === null ? null : parseFloat(value),
};
```

---

### Task 2: Create `User` entity

**Files:**
- Create: `backend/src/db/entities/user.entity.ts`

- [x] **Step 1: Create the entity file**

Actual implementation (updated from plan — extends `UuidV7BaseEntity`, `email` unique, `updatedAt`/`deletedAt` added, all timestamps `timestamptz`):

```typescript
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  UpdateDateColumn,
} from 'typeorm';
import { UuidV7BaseEntity } from './base.entity';

@Entity('users')
export class UserEntity extends UuidV7BaseEntity {
  @Column({ type: 'varchar', unique: true })
  email: string;

  @Column({ type: 'varchar', unique: true, name: 'firebase_uid' })
  firebaseUid: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
```

---

### Task 3: Create `Vehicle` entity

**Files:**
- Create: `backend/src/db/entities/vehicle.entity.ts`

- [x] **Step 1: Create the entity file**

Actual implementation (updated from plan — extends `UuidV7BaseEntity`, `@Index()` on `userId`, all timestamps `timestamptz`):

```typescript
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  ManyToOne,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { decimalTransformer } from '../transformers/decimal.transformer';
import { UuidV7BaseEntity } from './base.entity';

export enum MileageUnit {
  KM = 'km',
  MILE = 'mile',
}

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
    enum: MileageUnit,
    name: 'mileage_unit',
    default: MileageUnit.KM,
  })
  mileageUnit: MileageUnit;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
```

---

### Task 4: Create `MaintenanceCard` entity

**Files:**
- Create: `backend/src/db/entities/maintenance-card.entity.ts`

- [x] **Step 1: Create the entity file**

Actual implementation (updated from plan — extends `UuidV7BaseEntity`, `@Index()` on `vehicleId`, all timestamps `timestamptz`):

```typescript
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
} from 'typeorm';
import { VehicleEntity } from './vehicle.entity';
import { decimalTransformer } from '../transformers/decimal.transformer';
import { UuidV7BaseEntity } from './base.entity';

export enum MaintenanceCardType {
  TASK = 'task',
  PART = 'part',
  ITEM = 'item',
}

@Entity('maintenance_cards')
export class MaintenanceCardEntity extends UuidV7BaseEntity {
  @Index()
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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
```

---

### Task 5: Create `MaintenanceHistory` entity

**Files:**
- Create: `backend/src/db/entities/maintenance-history.entity.ts`

- [x] **Step 1: Create the entity file**

Actual implementation (updated from plan — extends `UuidV7BaseEntity`, `@Index()` on `maintenanceCardId`, `deletedAt` soft-delete added, all timestamps `timestamptz`):

```typescript
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { MaintenanceCardEntity } from './maintenance-card.entity';
import { decimalTransformer } from '../transformers/decimal.transformer';
import { UuidV7BaseEntity } from './base.entity';

@Entity('maintenance_histories')
export class MaintenanceHistoryEntity extends UuidV7BaseEntity {
  @Index()
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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
```

---

### Task 6: Create `BackgroundJob` entity

**Files:**
- Create: `backend/src/db/entities/background-job.entity.ts`

- [x] **Step 1: Create the entity file**

Actual implementation (updated from plan — extends `UuidV7BaseEntity`, `ttl` renamed to `expiresAt`/`expires_at`, all timestamps `timestamptz`):

```typescript
import { Column, CreateDateColumn, Entity, UpdateDateColumn } from 'typeorm';
import { UuidV7BaseEntity } from './base.entity';

export enum BackgroundJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  DONE = 'done',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('background_jobs')
export class BackgroundJobEntity extends UuidV7BaseEntity {
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

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_attempted_at' })
  lastAttemptedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

---

### New file: `base.entity.ts`

Not in the original plan. Created at `backend/src/db/entities/base.entity.ts`:

```typescript
import { BeforeInsert, PrimaryColumn } from 'typeorm';
import { uuidv7 } from 'uuidv7';

export abstract class UuidV7BaseEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = uuidv7();
    }
  }
}
```

---

## Chunk 2: Register Entities & Generate Migration

### Task 7: Register all entities and generate migration

**Files:**
- Modify: `backend/src/db/entity-model.ts`

- [x] **Step 1: Register all entities in `entity-model.ts`**

Implemented as specified.

- [x] **Step 2: Format and lint** — Passed.

- [x] **Step 3: Start services** — Services running via `just up-build`.

- [x] **Step 4: Build the backend** — `dist/` built successfully.

- [x] **Step 5: Generate the migration** — Final migration: `backend/src/db/migrations/1773633630216-init.ts`. The migration was regenerated multiple times during code review iterations; the final version includes all five tables, FK constraints, enum types, unique constraints on `users.email` and `background_jobs.idempotency_key`, and FK indexes (`IDX_88b36924d769e4df751bcfbf24` on `vehicles.user_id`, `IDX_5fb1428f4f64339bb2d4fd853b` on `maintenance_cards.vehicle_id`, `IDX_c1ae546d5f00a7677c491c377b` on `maintenance_histories.maintenance_card_id`).

- [x] **Step 6: Verify migration runs cleanly** — Passed.

- [x] **Step 7: Verify tables exist in the database** — All five tables confirmed present.

- [x] **Step 8: Run all unit tests** — Passed.

- [x] **Step 9: Format and lint** — Passed.

- [x] **Step 10: Commit** — Committed on branch `claude/slack-execute-implementation-plan-two-SrjE7`.
