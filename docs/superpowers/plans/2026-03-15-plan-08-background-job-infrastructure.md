# Plan 08: Background Job Infrastructure

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire BullMQ queue infrastructure, implement `BackgroundJobRepository` with idempotent insert and recovery queries, create a `QueueModule` for queue injection, scaffold `WorkerProcessor` with a `NotificationService` abstraction, build `WorkerModule`, add the `main-worker.ts` entry point, and close the deferred TODO from Plan 06 by cancelling background jobs when a card is marked done.

**Architecture:** Three new modules are added under `backend/src/modules/`: `background-job/` (repository only — no controller, no HTTP), `queue/` (BullMQ registration, exported for other modules), and `worker/` (processor + module bootstrapped by `main-worker.ts`). `WorkerProcessor` depends on an abstract `INotificationService` token so Plan 09 can supply the real implementation without changing the processor. `MaintenanceCardService` gains a `BackgroundJobRepository` dependency to cancel jobs on `markDone`. The worker entry point creates a NestJS application context (no HTTP server) and exits only on fatal error.

**Tech Stack:** `@nestjs/bullmq`, `bullmq`, NestJS `ConfigService`, TypeORM query builder, Vitest

**Spec reference:** `docs/superpowers/specs/2026-03-14-maintenance-tracker-design.md` — Section 5 (Worker & Notification Logic), Section 3 (BackgroundJob data model), Section 4 (Mark Done)

**Prerequisites:** Plans 01–07 must be complete. `BackgroundJobEntity` and `BackgroundJobStatus` are defined in `backend/src/db/entities/background-job.entity.ts` (Plan 02). `BullMQ` and `@nestjs/bullmq` are installed (Plan 01). `REDIS_URL` is in `.env.template` (Plan 01).

---

## Chunk 1: `BackgroundJobRepository`

### Task 1: Create `BackgroundJobRepository` with unit tests

**Files:**
- Create: `backend/src/modules/background-job/repositories/background-job.repository.ts`
- Create: `backend/src/modules/background-job/repositories/background-job.repository.spec.ts`

- [x] **Step 1: Write the failing test**

Create `backend/src/modules/background-job/repositories/background-job.repository.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In } from 'typeorm';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  BackgroundJobRepository,
  BACKGROUND_JOB_REFERENCE_TYPES,
  CreateBackgroundJobData,
} from './background-job.repository';
import {
  BackgroundJobEntity,
  BackgroundJobStatus,
} from 'src/db/entities/background-job.entity';

// Only insertIfNotExists uses the query builder (ON CONFLICT DO NOTHING has
// no Repository API equivalent). All other methods use Repository.find/update.
const mockQueryBuilder = {
  insert: vi.fn().mockReturnThis(),
  into: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  orIgnore: vi.fn().mockReturnThis(),
  returning: vi.fn().mockReturnThis(),
  execute: vi.fn(),
};

const mockTypeOrmRepo = {
  createQueryBuilder: vi.fn().mockReturnValue(mockQueryBuilder),
  create: vi.fn(),
  save: vi.fn(),
  find: vi.fn(),
  update: vi.fn(),
};

describe('BackgroundJobRepository', () => {
  let repository: BackgroundJobRepository;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockTypeOrmRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackgroundJobRepository,
        {
          provide: getRepositoryToken(BackgroundJobEntity),
          useValue: mockTypeOrmRepo,
        },
      ],
    }).compile();

    repository = module.get<BackgroundJobRepository>(BackgroundJobRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('#create', () => {
    it('creates and saves a new background job', async () => {
      const now = new Date();
      const creationData: CreateBackgroundJobData = {
        jobType: 'notification.upcoming',
        referenceId: 'card-1',
        referenceType: 'maintenance_card',
        idempotencyKey: 'notification.upcoming:card-1:2026-04-01',
        payload: { cardId: 'card-1' },
        scheduledFrom: now,
        expiresAt: new Date(now.getTime() + 86400000),
      };
      const job = {
        id: 'job-1',
        ...creationData,
      } as unknown as BackgroundJobEntity;

      mockTypeOrmRepo.create.mockReturnValue(job);
      mockTypeOrmRepo.save.mockResolvedValue(job);

      const result = await repository.create({ creationData });

      expect(mockTypeOrmRepo.create).toHaveBeenCalledWith(creationData);
      expect(mockTypeOrmRepo.save).toHaveBeenCalledWith(job);
      expect(result).toEqual(job);
    });
  });

  describe('#insertIfNotExists', () => {
    it('returns inserted row when no conflict', async () => {
      const now = new Date();
      const data: CreateBackgroundJobData = {
        jobType: 'notification.upcoming',
        referenceId: 'card-1',
        referenceType: 'maintenance_card',
        idempotencyKey: 'notification.upcoming:card-1:2026-04-01',
        payload: { cardId: 'card-1' },
        scheduledFrom: now,
        expiresAt: new Date(now.getTime() + 86400000),
      };
      const inserted = {
        id: 'job-1',
        ...data,
      } as unknown as BackgroundJobEntity;
      mockQueryBuilder.execute.mockResolvedValue({ raw: [inserted] });

      const result = await repository.insertIfNotExists(data);

      expect(result).toEqual(inserted);
    });

    it('returns null when conflict fires (job already exists)', async () => {
      const now = new Date();
      const data: CreateBackgroundJobData = {
        jobType: 'notification.upcoming',
        referenceId: 'card-1',
        referenceType: 'maintenance_card',
        idempotencyKey: 'notification.upcoming:card-1:2026-04-01',
        payload: { cardId: 'card-1' },
        scheduledFrom: now,
        expiresAt: new Date(now.getTime() + 86400000),
      };
      mockQueryBuilder.execute.mockResolvedValue({ raw: [] });

      const result = await repository.insertIfNotExists(data);

      expect(result).toBeNull();
    });
  });

  describe('#findPendingForRecovery', () => {
    it('returns jobs eligible for recovery', async () => {
      const jobs = [{ id: 'job-1' }] as BackgroundJobEntity[];
      mockTypeOrmRepo.find.mockResolvedValue(jobs);

      const result = await repository.findPendingForRecovery();

      expect(result).toEqual(jobs);
      expect(mockTypeOrmRepo.find).toHaveBeenCalledOnce();
    });
  });

  describe('#updateStatus', () => {
    it('updates job status by id', async () => {
      mockTypeOrmRepo.update.mockResolvedValue(undefined);

      await repository.updateStatus('job-1', BackgroundJobStatus.PROCESSING);

      expect(mockTypeOrmRepo.update).toHaveBeenCalledWith(
        { id: 'job-1' },
        { status: BackgroundJobStatus.PROCESSING },
      );
    });
  });

  describe('#cancelJobsForCard', () => {
    it('sets pending/processing jobs for a card to cancelled', async () => {
      mockTypeOrmRepo.update.mockResolvedValue(undefined);

      await repository.cancelJobsForCard('card-1');

      expect(mockTypeOrmRepo.update).toHaveBeenCalledWith(
        {
          referenceType: BACKGROUND_JOB_REFERENCE_TYPES.maintenanceCard,
          referenceId: 'card-1',
          status: In([
            BackgroundJobStatus.PENDING,
            BackgroundJobStatus.PROCESSING,
          ]),
        },
        { status: BackgroundJobStatus.CANCELLED },
      );
    });

    it('uses entityManager repo when provided', async () => {
      const emRepo = { update: vi.fn().mockResolvedValue(undefined) };
      const entityManager = {
        getRepository: vi.fn().mockReturnValue(emRepo),
      };

      await repository.cancelJobsForCard(
        'card-1',
        entityManager as unknown as import('typeorm').EntityManager,
      );

      expect(entityManager.getRepository).toHaveBeenCalledWith(
        BackgroundJobEntity,
      );
      expect(emRepo.update).toHaveBeenCalled();
      expect(mockTypeOrmRepo.update).not.toHaveBeenCalled();
    });
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

```bash
cd backend && pnpm exec vitest run src/modules/background-job/repositories/background-job.repository.spec.ts
```

Expected: FAIL — `BackgroundJobRepository` not found.

- [x] **Step 3: Create `BackgroundJobRepository`**

Create `backend/src/modules/background-job/repositories/background-job.repository.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  In,
  LessThanOrEqual,
  MoreThan,
  Repository,
} from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
  BackgroundJobEntity,
  BackgroundJobStatus,
} from 'src/db/entities/background-job.entity';
import { BaseDBUtil } from 'src/modules/common/base-classes/base-db-util';
import { JobType } from '../enums/job-type.enum';

export const BACKGROUND_JOB_REFERENCE_TYPES = {
  maintenanceCard: 'maintenance_card',
} as const;

export type CreateBackgroundJobData = {
  jobType: JobType;
  referenceId: string | null;
  referenceType: string | null;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  scheduledFrom: Date;
  expiresAt: Date;
};

@Injectable()
export class BackgroundJobRepository extends BaseDBUtil<
  BackgroundJobEntity,
  CreateBackgroundJobData
> {
  constructor(
    @InjectRepository(BackgroundJobEntity)
    private readonly backgroundJobRepo: Repository<BackgroundJobEntity>,
  ) {
    super(BackgroundJobEntity, backgroundJobRepo);
  }

  private repoFor(em?: EntityManager): Repository<BackgroundJobEntity> {
    return (
      (em?.getRepository(BackgroundJobEntity) as Repository<BackgroundJobEntity>) ??
      this.repo
    );
  }

  async create(params: {
    creationData: CreateBackgroundJobData;
    entityManager?: EntityManager;
  }): Promise<BackgroundJobEntity> {
    const { creationData, entityManager } = params;
    const repo = this.repoFor(entityManager);
    const job = repo.create(creationData);
    return await repo.save(job);
  }

  /**
   * INSERT ... ON CONFLICT (idempotency_key) DO NOTHING RETURNING *
   * Returns the inserted row, or null if the idempotency_key already existed.
   */
  async insertIfNotExists(
    data: CreateBackgroundJobData,
  ): Promise<BackgroundJobEntity | null> {
    const result = await this.backgroundJobRepo
      .createQueryBuilder()
      .insert()
      .into(BackgroundJobEntity)
      .values(data as QueryDeepPartialEntity<BackgroundJobEntity>)
      .orIgnore()
      .returning('*')
      .execute();

    const rows = result.raw as BackgroundJobEntity[];
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Finds jobs in pending/processing state eligible for recovery:
   * scheduled_from <= now AND expires_at > now
   *
   * Uses Repository.find() with TypeORM find operators — no query builder needed.
   */
  async findPendingForRecovery(): Promise<BackgroundJobEntity[]> {
    return this.repo.find({
      where: {
        status: In([BackgroundJobStatus.PENDING, BackgroundJobStatus.PROCESSING]),
        scheduledFrom: LessThanOrEqual(new Date()),
        expiresAt: MoreThan(new Date()),
      },
    });
  }

  /**
   * Updates a single job's status by id.
   */
  async updateStatus(id: string, status: BackgroundJobStatus): Promise<void> {
    await this.backgroundJobRepo.update({ id }, { status });
  }

  /**
   * Cancels all pending/processing jobs for a maintenance card.
   * Called when a card is marked done or deleted.
   * Pass entityManager to run within an existing transaction.
   *
   * Uses Repository.update() with In() — query builder not needed here.
   * insertIfNotExists is the only method that still requires the query builder
   * because ON CONFLICT DO NOTHING has no Repository API equivalent.
   */
  async cancelJobsForCard(
    cardId: string,
    entityManager?: EntityManager,
  ): Promise<void> {
    await this.repoFor(entityManager).update(
      {
        referenceType: BACKGROUND_JOB_REFERENCE_TYPES.maintenanceCard,
        referenceId: cardId,
        status: In([BackgroundJobStatus.PENDING, BackgroundJobStatus.PROCESSING]),
      },
      { status: BackgroundJobStatus.CANCELLED },
    );
  }
}
```

- [x] **Step 4: Run the test to verify it passes**

```bash
cd backend && pnpm exec vitest run src/modules/background-job/repositories/background-job.repository.spec.ts
```

Expected: PASS — all 6 tests green.

- [x] **Step 5: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [x] **Step 6: Commit**

```bash
git add backend/src/modules/background-job/repositories/background-job.repository.ts \
        backend/src/modules/background-job/repositories/background-job.repository.spec.ts
git commit -m "feat: add BackgroundJobRepository with idempotent insert and recovery queries"
```

---

### Task 2: Create `BackgroundJobModule`

**Files:**
- Create: `backend/src/modules/background-job/background-job.module.ts`

- [x] **Step 1: Create `BackgroundJobModule`**

Create `backend/src/modules/background-job/background-job.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BackgroundJobEntity } from 'src/db/entities/background-job.entity';
import { BackgroundJobRepository } from './repositories/background-job.repository';

@Module({
  imports: [TypeOrmModule.forFeature([BackgroundJobEntity])],
  providers: [BackgroundJobRepository],
  exports: [BackgroundJobRepository],
})
export class BackgroundJobModule {}
```

- [x] **Step 2: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [x] **Step 3: Commit**

```bash
git add backend/src/modules/background-job/background-job.module.ts
git commit -m "feat: add BackgroundJobModule"
```

---

## Chunk 2: `QueueModule`

### Task 3: Create `QueueModule` for BullMQ queue registration

**Files:**
- Create: `backend/src/modules/queue/queue.module.ts`

`QueueModule` registers the `'maintenance'` BullMQ queue using `REDIS_URL` from `ConfigService`. It is imported by any module that needs to enqueue jobs (the Scheduler in Plan 09) and by `WorkerModule`. `BullModule.forRootAsync` is called in the consuming root module (WorkerModule or AppModule) — `QueueModule` uses `registerQueueAsync` and relies on the root connection being registered upstream.

- [x] **Step 1: Create `QueueModule`**

Create `backend/src/modules/queue/queue.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'maintenance',
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
```

- [x] **Step 2: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [x] **Step 3: Commit**

```bash
git add backend/src/modules/queue/queue.module.ts
git commit -m "feat: add QueueModule with BullMQ maintenance queue registration"
```

---

## Chunk 3: `WorkerProcessor` and `WorkerModule`

### Task 4: Define `INotificationService` abstraction token

**Files:**
- Create: `backend/src/modules/worker/notification-service.interface.ts`

`WorkerProcessor` must not import `NotificationModule` directly — Plan 09 wires the real implementation. An injection token and interface allow the processor to declare its dependency without coupling to the concrete class.

- [x] **Step 1: Create the interface file**

Create `backend/src/modules/worker/notification-service.interface.ts`:

```typescript
import { BackgroundJobEntity } from 'src/db/entities/background-job.entity';

export const NOTIFICATION_SERVICE_TOKEN = Symbol('NOTIFICATION_SERVICE_TOKEN');

export interface INotificationService {
  sendUpcomingNotification(backgroundJob: BackgroundJobEntity): Promise<void>;
  sendOverdueNotification(backgroundJob: BackgroundJobEntity): Promise<void>;
}
```

- [x] **Step 2: Commit**

```bash
git add backend/src/modules/worker/notification-service.interface.ts
git commit -m "feat: add INotificationService abstraction token for WorkerProcessor"
```

---

### Task 5: Create `WorkerProcessor` with unit tests

**Files:**
- Create: `backend/src/modules/worker/worker.processor.ts`
- Create: `backend/src/modules/worker/worker.processor.spec.ts`

- [x] **Step 1: Write the failing test**

Create `backend/src/modules/worker/worker.processor.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { WorkerProcessor } from './worker.processor';
import { BackgroundJobRepository } from 'src/modules/background-job/repositories/background-job.repository';
import {
  BackgroundJobEntity,
  BackgroundJobStatus,
} from 'src/db/entities/background-job.entity';
import {
  INotificationService,
  NOTIFICATION_SERVICE_TOKEN,
} from './notification-service.interface';

const mockBackgroundJobRepository = {
  getOne: vi.fn(),
  updateStatus: vi.fn(),
};

const mockNotificationService: INotificationService = {
  sendUpcomingNotification: vi.fn(),
  sendOverdueNotification: vi.fn(),
};

const makeJob = (backgroundJobId: string): Job<{ backgroundJobId: string }> =>
  ({ data: { backgroundJobId } }) as Job<{ backgroundJobId: string }>;

describe('WorkerProcessor', () => {
  let processor: WorkerProcessor;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkerProcessor,
        {
          provide: BackgroundJobRepository,
          useValue: mockBackgroundJobRepository,
        },
        {
          provide: NOTIFICATION_SERVICE_TOKEN,
          useValue: mockNotificationService,
        },
      ],
    }).compile();

    processor = module.get<WorkerProcessor>(WorkerProcessor);
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('#process', () => {
    it('skips silently when BackgroundJob is not found', async () => {
      mockBackgroundJobRepository.getOne.mockResolvedValue(null);

      await processor.process(makeJob('job-1'));

      expect(mockBackgroundJobRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockNotificationService.sendUpcomingNotification).not.toHaveBeenCalled();
    });

    it('skips silently when job status is not pending', async () => {
      const job = {
        id: 'job-1',
        status: BackgroundJobStatus.DONE,
        jobType: 'notification.upcoming',
        ttl: new Date(Date.now() + 86400000),
      } as BackgroundJobEntity;
      mockBackgroundJobRepository.getOne.mockResolvedValue(job);

      await processor.process(makeJob('job-1'));

      expect(mockBackgroundJobRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('marks done directly when TTL has passed (stale fast-path)', async () => {
      const job = {
        id: 'job-1',
        status: BackgroundJobStatus.PENDING,
        jobType: 'notification.upcoming',
        ttl: new Date(Date.now() - 1000),
      } as BackgroundJobEntity;
      mockBackgroundJobRepository.getOne.mockResolvedValue(job);
      mockBackgroundJobRepository.updateStatus.mockResolvedValue(undefined);

      await processor.process(makeJob('job-1'));

      expect(mockBackgroundJobRepository.updateStatus).toHaveBeenCalledWith(
        'job-1',
        BackgroundJobStatus.DONE,
      );
      expect(mockNotificationService.sendUpcomingNotification).not.toHaveBeenCalled();
    });

    it('processes notification.upcoming job successfully', async () => {
      const backgroundJob = {
        id: 'job-1',
        status: BackgroundJobStatus.PENDING,
        jobType: 'notification.upcoming',
        ttl: new Date(Date.now() + 86400000),
      } as BackgroundJobEntity;
      mockBackgroundJobRepository.getOne.mockResolvedValue(backgroundJob);
      mockBackgroundJobRepository.updateStatus.mockResolvedValue(undefined);
      vi.mocked(mockNotificationService.sendUpcomingNotification).mockResolvedValue(undefined);

      await processor.process(makeJob('job-1'));

      expect(mockBackgroundJobRepository.updateStatus).toHaveBeenCalledWith(
        'job-1',
        BackgroundJobStatus.PROCESSING,
      );
      expect(mockNotificationService.sendUpcomingNotification).toHaveBeenCalledWith(backgroundJob);
      expect(mockBackgroundJobRepository.updateStatus).toHaveBeenCalledWith(
        'job-1',
        BackgroundJobStatus.DONE,
      );
    });

    it('processes notification.overdue job successfully', async () => {
      const backgroundJob = {
        id: 'job-1',
        status: BackgroundJobStatus.PENDING,
        jobType: 'notification.overdue',
        ttl: new Date(Date.now() + 86400000),
      } as BackgroundJobEntity;
      mockBackgroundJobRepository.getOne.mockResolvedValue(backgroundJob);
      mockBackgroundJobRepository.updateStatus.mockResolvedValue(undefined);
      vi.mocked(mockNotificationService.sendOverdueNotification).mockResolvedValue(undefined);

      await processor.process(makeJob('job-1'));

      expect(mockNotificationService.sendOverdueNotification).toHaveBeenCalledWith(backgroundJob);
      expect(mockBackgroundJobRepository.updateStatus).toHaveBeenCalledWith(
        'job-1',
        BackgroundJobStatus.DONE,
      );
    });

    it('marks failed and re-throws on unknown job type without marking done', async () => {
      const backgroundJob = {
        id: 'job-1',
        status: BackgroundJobStatus.PENDING,
        jobType: 'unknown.type',
        ttl: new Date(Date.now() + 86400000),
      } as BackgroundJobEntity;
      mockBackgroundJobRepository.getOne.mockResolvedValue(backgroundJob);
      mockBackgroundJobRepository.updateStatus.mockResolvedValue(undefined);

      await expect(processor.process(makeJob('job-1'))).rejects.toThrow('Unknown job type');

      expect(mockBackgroundJobRepository.updateStatus).toHaveBeenCalledWith(
        'job-1',
        BackgroundJobStatus.FAILED,
      );
      expect(mockBackgroundJobRepository.updateStatus).not.toHaveBeenCalledWith(
        'job-1',
        BackgroundJobStatus.DONE,
      );
    });

    it('marks failed and re-throws on handler error', async () => {
      const backgroundJob = {
        id: 'job-1',
        status: BackgroundJobStatus.PENDING,
        jobType: 'notification.upcoming',
        ttl: new Date(Date.now() + 86400000),
      } as BackgroundJobEntity;
      mockBackgroundJobRepository.getOne.mockResolvedValue(backgroundJob);
      mockBackgroundJobRepository.updateStatus.mockResolvedValue(undefined);
      const error = new Error('email send failed');
      vi.mocked(mockNotificationService.sendUpcomingNotification).mockRejectedValue(error);

      await expect(processor.process(makeJob('job-1'))).rejects.toThrow('email send failed');

      expect(mockBackgroundJobRepository.updateStatus).toHaveBeenCalledWith(
        'job-1',
        BackgroundJobStatus.FAILED,
      );
    });
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

```bash
cd backend && pnpm exec vitest run src/modules/worker/worker.processor.spec.ts
```

Expected: FAIL — `WorkerProcessor` not found.

- [x] **Step 3: Create `WorkerProcessor`**

Create `backend/src/modules/worker/worker.processor.ts`:

```typescript
import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  BackgroundJobEntity,
  BackgroundJobStatus,
} from 'src/db/entities/background-job.entity';
import { BackgroundJobRepository } from 'src/modules/background-job/repositories/background-job.repository';
import {
  INotificationService,
  NOTIFICATION_SERVICE_TOKEN,
} from './notification-service.interface';

@Processor('maintenance')
export class WorkerProcessor extends WorkerHost {
  private readonly logger = new Logger(WorkerProcessor.name);

  constructor(
    private readonly backgroundJobRepository: BackgroundJobRepository,
    @Inject(NOTIFICATION_SERVICE_TOKEN)
    private readonly notificationService: INotificationService,
  ) {
    super();
  }

  async process(job: Job<{ backgroundJobId: string }>): Promise<void> {
    const { backgroundJobId } = job.data;

    const backgroundJob = await this.backgroundJobRepository.getOne({
      criteria: { id: backgroundJobId },
    });

    if (!backgroundJob) {
      this.logger.log(`BackgroundJob ${backgroundJobId} not found — skipping`);
      return;
    }

    if (backgroundJob.status !== BackgroundJobStatus.PENDING) {
      this.logger.log(
        `BackgroundJob ${backgroundJobId} has status ${backgroundJob.status} — skipping`,
      );
      return;
    }

    // Stale fast-path: TTL has passed, mark done without executing handler
    if (backgroundJob.ttl <= new Date()) {
      this.logger.log(
        `BackgroundJob ${backgroundJobId} TTL expired — marking done (stale fast-path)`,
      );
      await this.backgroundJobRepository.updateStatus(backgroundJobId, BackgroundJobStatus.DONE);
      return;
    }

    await this.backgroundJobRepository.updateStatus(backgroundJobId, BackgroundJobStatus.PROCESSING);

    try {
      await this.dispatch(backgroundJob);
      await this.backgroundJobRepository.updateStatus(backgroundJobId, BackgroundJobStatus.DONE);
    } catch (err) {
      this.logger.error(
        `BackgroundJob ${backgroundJobId} failed: ${(err as Error).message}`,
      );
      await this.backgroundJobRepository.updateStatus(backgroundJobId, BackgroundJobStatus.FAILED);
      throw err;
    }
  }

  private async dispatch(backgroundJob: BackgroundJobEntity): Promise<void> {
    switch (backgroundJob.jobType) {
      case 'notification.upcoming':
        await this.notificationService.sendUpcomingNotification(backgroundJob);
        break;
      case 'notification.overdue':
        await this.notificationService.sendOverdueNotification(backgroundJob);
        break;
      default:
        throw new Error(`Unknown job type "${backgroundJob.jobType}"`);
    }
  }
}
```

- [x] **Step 4: Run the test to verify it passes**

```bash
cd backend && pnpm exec vitest run src/modules/worker/worker.processor.spec.ts
```

Expected: PASS — all 7 tests green.

- [x] **Step 5: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [x] **Step 6: Commit**

```bash
git add backend/src/modules/worker/worker.processor.ts \
        backend/src/modules/worker/worker.processor.spec.ts
git commit -m "feat: add WorkerProcessor with BullMQ job dispatch and TTL stale fast-path"
```

---

### Task 6: Create `WorkerModule` with stub `NotificationService`

**Files:**
- Create: `backend/src/modules/worker/notification-service.stub.ts`
- Create: `backend/src/modules/worker/worker.module.ts`

`WorkerModule` is the root module for the worker process. It wires Redis for BullMQ (`BullModule.forRootAsync`), imports `QueueModule` and `BackgroundJobModule`, and provides a stub `NotificationService`. Plan 09 replaces the stub by overriding the `NOTIFICATION_SERVICE_TOKEN` binding.

- [x] **Step 1: Create `notification-service.stub.ts`**

Create `backend/src/modules/worker/notification-service.stub.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { BackgroundJobEntity } from 'src/db/entities/background-job.entity';
import { INotificationService } from './notification-service.interface';

/**
 * Stub implementation used until Plan 09 wires the real NotificationModule.
 * Logs a warning so it is obvious in dev that emails are not being sent.
 */
@Injectable()
export class NotificationServiceStub implements INotificationService {
  private readonly logger = new Logger(NotificationServiceStub.name);

  async sendUpcomingNotification(backgroundJob: BackgroundJobEntity): Promise<void> {
    this.logger.warn(
      `[STUB] sendUpcomingNotification called for BackgroundJob ${backgroundJob.id} — not implemented yet`,
    );
  }

  async sendOverdueNotification(backgroundJob: BackgroundJobEntity): Promise<void> {
    this.logger.warn(
      `[STUB] sendOverdueNotification called for BackgroundJob ${backgroundJob.id} — not implemented yet`,
    );
  }
}
```

- [x] **Step 2: Create `WorkerModule`**

Create `backend/src/modules/worker/worker.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BackgroundJobModule } from 'src/modules/background-job/background-job.module';
import { QueueModule } from 'src/modules/queue/queue.module';
import { AppConfig } from 'src/configs/app.config';
import { WorkerProcessor } from './worker.processor';
import { NotificationServiceStub } from './notification-service.stub';
import { NOTIFICATION_SERVICE_TOKEN } from './notification-service.interface';

@Module({
  imports: [
    AppConfig.configModule,
    AppConfig.typeormModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          url: configService.get<string>('REDIS_URL'),
        },
      }),
    }),
    QueueModule,
    BackgroundJobModule,
  ],
  providers: [
    WorkerProcessor,
    {
      provide: NOTIFICATION_SERVICE_TOKEN,
      useClass: NotificationServiceStub,
    },
  ],
})
export class WorkerModule {}
```

- [x] **Step 3: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [x] **Step 4: Commit**

```bash
git add backend/src/modules/worker/notification-service.stub.ts \
        backend/src/modules/worker/worker.module.ts
git commit -m "feat: add WorkerModule with stub NotificationService binding"
```

---

## Chunk 4: Worker Entry Point

### Task 7: Create `main-worker.ts` and update `docker-compose.yml`

**Files:**
- Create: `backend/src/main-worker.ts`
- Modify: `docker-compose.yml`

- [x] **Step 1: Create `main-worker.ts`**

Create `backend/src/main-worker.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './modules/worker/worker.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['log', 'warn', 'error', 'debug'],
  });

  // Keep the process alive — BullMQ workers wake up on queue events
  app.enableShutdownHooks();
}

bootstrap().catch((err: unknown) => {
  console.error('Worker failed to start', err);
  process.exit(1);
});
```

- [x] **Step 2: Update `docker-compose.yml` with the worker service**

In `docker-compose.yml`, replace the commented-out `worker` placeholder (added in Plan 01) with the real service definition:

```yaml
  worker:
    build:
      context: .
      dockerfile: backend/Dockerfile
    command: node dist/main-worker.js
    env_file:
      - .env
    depends_on:
      postgres:
        condition: service_healthy
        restart: true
      redis:
        condition: service_healthy
        restart: true
    restart: unless-stopped
```

- [x] **Step 3: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [x] **Step 4: Commit**

```bash
git add backend/src/main-worker.ts docker-compose.yml
git commit -m "feat: add main-worker.ts entry point and worker Docker Compose service"
```

---

## Chunk 5: Close Plan 06 Deferred TODO — Cancel Jobs on `markDone`

### Task 8: Inject `BackgroundJobRepository` into `MaintenanceCardService`

**Files:**
- Modify: `backend/src/modules/maintenance-card/maintenance-card.module.ts`
- Modify: `backend/src/modules/maintenance-card/services/maintenance-card.service.ts`
- Modify: `backend/src/modules/maintenance-card/services/maintenance-card.service.spec.ts`

- [x] **Step 1: Add failing test for job cancellation in `markDone`**

In `backend/src/modules/maintenance-card/services/maintenance-card.service.spec.ts`:

Add import at the top:

```typescript
import { BackgroundJobRepository } from 'src/modules/background-job/repositories/background-job.repository';
```

Add mock object:

```typescript
const mockBackgroundJobRepository = {
  cancelJobsForCard: vi.fn(),
};
```

Add to the `TestingModule` providers inside `beforeEach`:

```typescript
{ provide: BackgroundJobRepository, useValue: mockBackgroundJobRepository },
```

Add inside the existing `describe('#markDone', ...)` block:

```typescript
it('cancels pending background jobs for the card after creating history', async () => {
  await service.markDone(cardId, vehicleId, userId, { doneAtMileage: 12500 });

  expect(mockBackgroundJobRepository.cancelJobsForCard).toHaveBeenCalledWith(cardId);
});
```

- [x] **Step 2: Run the test to verify it fails**

```bash
cd backend && pnpm exec vitest run src/modules/maintenance-card/services/maintenance-card.service.spec.ts
```

Expected: FAIL — `BackgroundJobRepository` not provided or `cancelJobsForCard` not called.

- [x] **Step 3: Import `BackgroundJobModule` into `MaintenanceCardModule`**

In `backend/src/modules/maintenance-card/maintenance-card.module.ts`, add `BackgroundJobModule` to imports:

```typescript
import { BackgroundJobModule } from 'src/modules/background-job/background-job.module';
```

Add `BackgroundJobModule` to the `imports` array alongside existing imports. Do not replace the file — only add the import.

- [x] **Step 4: Update `MaintenanceCardService` to inject and call `cancelJobsForCard`**

In `backend/src/modules/maintenance-card/services/maintenance-card.service.ts`:

Add import:

```typescript
import { BackgroundJobRepository } from 'src/modules/background-job/repositories/background-job.repository';
```

Add `BackgroundJobRepository` to the constructor:

```typescript
constructor(
  private readonly cardRepository: MaintenanceCardRepository,
  private readonly historyRepository: MaintenanceHistoryRepository,
  @Inject(forwardRef(() => VehicleService))
  private readonly vehicleService: VehicleService,
  private readonly backgroundJobRepository: BackgroundJobRepository,
) {}
```

In `markDone`, after the `historyRepository.create(...)` call, add:

```typescript
await this.backgroundJobRepository.cancelJobsForCard(id);
```

- [x] **Step 5: Run the test to verify it passes**

```bash
cd backend && pnpm exec vitest run src/modules/maintenance-card/services/maintenance-card.service.spec.ts
```

Expected: PASS — all tests green.

- [x] **Step 6: Run all unit tests**

```bash
just test-unit
```

Expected: All tests pass.

- [x] **Step 7: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [x] **Step 8: Commit**

```bash
git add backend/src/modules/maintenance-card/maintenance-card.module.ts \
        backend/src/modules/maintenance-card/services/maintenance-card.service.ts \
        backend/src/modules/maintenance-card/services/maintenance-card.service.spec.ts
git commit -m "feat: cancel background jobs for card on markDone (deferred from Plan 06)"
```

---

## Chunk 6: Build Verification

### Task 9: Build and smoke test

- [x] **Step 1: Build all workspaces**

```bash
just build
```

Expected: No TypeScript errors. `backend/dist/main-worker.js` is produced.

- [x] **Step 2: Run the full unit test suite**

```bash
just test-unit
```

Expected: All tests pass.

- [x] **Step 3: Start all services and verify worker comes online**

```bash
just up-build
docker compose logs worker --follow
```

---

## Code Review Analysis (2026-03-23)

PR #16 was reviewed by Claude bot. Below is the analysis of each issue.

### Valid Issues

#### Bug 1: `insertIfNotExists` raw result cast is unsafe (Issue #1)

**Valid.** TypeORM's `.returning('*')` returns raw DB rows with snake_case column names (`idempotency_key`, `expires_at`) — not the camelCase TypeORM entity properties (`idempotencyKey`, `expiresAt`). The cast `result.raw as BackgroundJobEntity[]` hides this mismatch. Callers accessing camelCase properties would silently get `undefined`.

**Root cause:** QueryBuilder raw results bypass TypeORM's column name mapping. The entity has explicit `@Column({ name: 'snake_case' })` mappings that only apply to the ORM layer, not raw results.

**Fix:** After the insert succeeds (raw.length > 0), re-fetch by `idempotencyKey` using the repo's normal `findOne` so TypeORM applies its column mapping. Return `null` on conflict (raw.length === 0) unchanged.

#### Bug 2: `deleteCard` doesn't cancel background jobs (Issue #2)

**Valid.** `deleteCard` soft-deletes the card but never calls `cancelJobsForCard`. The JSDoc on `cancelJobsForCard` says "Called when a card is marked done or deleted" but only `markDone` currently does it. Deleting a card leaves pending background jobs orphaned in the DB.

**Fix:** Call `this.backgroundJobRepository.cancelJobsForCard(id)` after the card is deleted in `deleteCard`. Add test coverage.

#### Medium: `updateStatus(PROCESSING)` outside try block (Issue #3)

**Partially valid** (code improvement reasonable; reviewer's described impact is wrong).

Reviewer claims: "The non-PENDING guard on line 37 will then skip it on any retry." This is **incorrect** — if `updateStatus(PROCESSING)` throws, the DB job stays PENDING, so the guard would NOT skip it on retry. The retry would actually work correctly.

However, the improvement is still reasonable as defensive code: if BullMQ exhausts retries while the job is stuck PENDING from a transient DB failure, the job would strand. Moving the PROCESSING update inside the try block ensures the FAILED path is always reachable regardless of retry configuration.

**Fix:** Move `updateStatus(PROCESSING)` call inside the try block.

#### Minor: `QueueModule` undocumented dependency on `BullModule.forRoot` (Issue #4)

**Valid as documentation concern.** `QueueModule` calls `BullModule.registerQueue()` without configuring the Redis connection. This is the standard NestJS BullMQ pattern, but future module authors may not know they need `BullModule.forRoot` configured in the importing context.

**Fix:** Add a clarifying comment to `QueueModule` documenting the constraint.

#### Minor: Worker service missing restart policy (Issue #6)

**Valid.** The `worker` service in `docker-compose.yml` has no service-level `restart:` key. If the worker crashes on startup (e.g., unhandled rejection), Docker won't restart it.

Note: The reviewer claims "server uses `restart: true` via `depends_on`" which is misleading — `depends_on.restart: true` means "restart *this* container if the dependency restarts", not a service restart policy. The `server` service also lacks a service-level restart policy, but worker should have one since it's a background processing service.

**Fix:** Add `restart: unless-stopped` to the `worker` service.

#### Minor: `findPendingForRecovery` calls `new Date()` twice (Issue #7)

**Valid.** Two separate `new Date()` calls create a tiny timing window where `scheduledFrom <= now` and `expiresAt > now` are evaluated against slightly different timestamps.

**Fix:** Extract to `const now = new Date()` before the query.

#### Noted for future: Inconsistent parameter style (Issue #8)

**Valid but deferred.** `create` takes `{ creationData, entityManager? }` (options object); `insertIfNotExists` takes `data` directly. The reviewer acknowledges this may be intentional since `insertIfNotExists` doesn't support `entityManager` yet. Align when support is added.

**No immediate action.**

### Invalid Issues

#### Issue #5: Non-deterministic `pnpm@latest` in Dockerfile

**Invalid.** The reviewer claims "The other Dockerfiles in this repo likely pin a version." This is factually incorrect — `Dockerfile.backend` (line 11) also uses `npm install -g pnpm@latest`. Using `@latest` is the established convention across all Dockerfiles in this repo. Changing `Dockerfile.background-job` alone would create inconsistency. This should be addressed as a repo-wide change if desired.

Expected: NestJS bootstrap logs appear from the worker container. No Redis or Postgres `ECONNREFUSED` errors. Worker sits idle waiting for queue messages.

---

## Code Review Analysis (2026-03-23) — Second Pass

Performed after addressing PR #16 feedback. Three issues were found; all three were valid and resolved.

### Issue 1: `deleteCard` cancels jobs outside a transaction — **Bug, Fixed**

**Finding:** `deleteCard` called `cardRepository.delete` followed by `cancelJobsForCard(id)` with no transaction wrapping. If `cancelJobsForCard` throws after the card is already deleted, background jobs remain in `PENDING` state for a card that no longer exists. The worker then fires notifications for a deleted card.

**Contrast:** `markDone` correctly wraps `cancelJobsForCard(id, em)` inside `dataSource.transaction`. The same pattern was not applied to `deleteCard` when the cancellation call was added.

**Decision:** Wrap both `cardRepository.delete` and `cancelJobsForCard` in `dataSource.transaction`. Pass `entityManager` to both so they execute atomically. Three tests added/updated: delete passes `entityManager` to repository, cancellation is called with `entityManager`, and cancellation does not happen when delete fails.

**Files changed:**
- `backend/src/modules/maintenance-card/services/maintenance-card.service.ts` — wrapped in transaction
- `backend/src/modules/maintenance-card/services/maintenance-card.service.spec.ts` — updated 2 tests, added 1 new test

### Issue 2: `repoFor` cast is unnecessary — **Code Smell, Fixed**

**Finding:** `repoFor` in `BackgroundJobRepository` cast the result of `em.getRepository(BackgroundJobEntity)` to `Repository<BackgroundJobEntity>`. TypeORM's `EntityManager.getRepository<T>(entity)` signature is `getRepository<Entity>(target: EntityTarget<Entity>): Repository<Entity>` — the return type is already `Repository<BackgroundJobEntity>`. The cast was noise that obscured the real type.

**Decision:** Remove the cast. No behavior change; purely a type-level cleanup. No new tests required.

**Files changed:**
- `backend/src/modules/background-job/repositories/background-job.repository.ts` — removed `as Repository<BackgroundJobEntity>` cast in `repoFor`

### Issue 3: `QueueModule` depended on caller to configure `BullModule.forRoot` — **Design Footgun, Fixed**

**Finding:** `QueueModule` called `BullModule.registerQueue()` but expected the importing context to have called `BullModule.forRootAsync()` separately. Only `WorkerModule` did this. A comment warned future authors of the constraint, but this is a maintenance trap: when Plan 09 adds job enqueueing from the main `AppModule`, importing `QueueModule` without knowing to also configure `BullModule.forRoot` would cause a runtime failure.

**Decision:** Move `BullModule.forRootAsync` into `QueueModule` itself so it is self-contained. Any module that imports `QueueModule` automatically gets a working Redis connection. Removed the duplicate `BullModule.forRootAsync` and the now-unused `BullModule`, `ConfigModule`, `ConfigService` imports from `WorkerModule`. `ConfigModule` is registered globally by `AppConfig.configModule` (`isGlobal: true`), so `QueueModule`'s `forRootAsync` can inject `ConfigService` without issues.

**Files changed:**
- `backend/src/modules/queue/queue.module.ts` — added `BullModule.forRootAsync`, removed warning comment
- `backend/src/modules/worker/worker.module.ts` — removed `BullModule.forRootAsync`, removed `BullModule`/`ConfigModule`/`ConfigService` imports

---

## Post-Merge Code Review Notes

### Issue: `removeOnFail: true` — **Valid, Fixed**

**Finding:** `removeOnFail: true` in `QueueModule.defaultJobOptions` causes BullMQ to immediately delete every failed job from Redis, taking the payload, stack trace, and retry history with it. No evidence for debugging when the notification processor fails.

**Decision:** Changed to `removeOnFail: { count: 100 }` to retain the last 100 failures for inspection.

**Files changed:**
- `backend/src/modules/queue/queue.module.ts` — `removeOnFail: true` → `removeOnFail: { count: 100 }`

### Issue: `pnpm@latest` non-deterministic in `Dockerfile.background-job` — **Invalid, Not Fixed**

**Reviewer claim:** "The other Dockerfiles in this repo likely pin a version. Pin this to match."

**Finding:** This premise is false. `docker/local/Dockerfile.backend:11` also uses `RUN npm install -g pnpm@latest`. Every local Dockerfile in the repo uses `pnpm@latest` — the new background-job Dockerfile is consistent with the existing pattern. Fixing only `Dockerfile.background-job` would introduce inconsistency across Dockerfiles. This would require a coordinated change across all Dockerfiles, which is out of scope for this PR and not caused by it.

### Issue: Worker watch `action: sync` should be `sync+restart` — **Invalid, Not Fixed**

**Reviewer claim:** "The `server` service uses `action: sync+restart` for `./backend/src`. The worker uses plain `sync`, so code changes won't trigger a process restart."

**Finding:** This is factually wrong. The `server` service in `docker-compose.yml` also uses `action: sync` for `./backend/src` — not `sync+restart`. Only `./packages` in the `client` service uses `sync+restart` (because Next.js needs a restart to pick up shared type changes). The worker service is consistent with the server service. Both rely on NestJS `nest start --watch` (via `pnpm run dev:worker`) to detect file changes inside the container — `sync` copies files in, the internal watcher handles the restart.
