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

- [ ] **Step 1: Write the failing test**

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

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend && pnpm exec vitest run src/modules/background-job/repositories/background-job.repository.spec.ts
```

Expected: FAIL — `BackgroundJobRepository` not found.

- [ ] **Step 3: Create `BackgroundJobRepository`**

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

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd backend && pnpm exec vitest run src/modules/background-job/repositories/background-job.repository.spec.ts
```

Expected: PASS — all 6 tests green.

- [ ] **Step 5: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/background-job/repositories/background-job.repository.ts \
        backend/src/modules/background-job/repositories/background-job.repository.spec.ts
git commit -m "feat: add BackgroundJobRepository with idempotent insert and recovery queries"
```

---

### Task 2: Create `BackgroundJobModule`

**Files:**
- Create: `backend/src/modules/background-job/background-job.module.ts`

- [ ] **Step 1: Create `BackgroundJobModule`**

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

- [ ] **Step 2: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [ ] **Step 3: Commit**

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

- [ ] **Step 1: Create `QueueModule`**

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

- [ ] **Step 2: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [ ] **Step 3: Commit**

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

- [ ] **Step 1: Create the interface file**

Create `backend/src/modules/worker/notification-service.interface.ts`:

```typescript
import { BackgroundJobEntity } from 'src/db/entities/background-job.entity';

export const NOTIFICATION_SERVICE_TOKEN = Symbol('NOTIFICATION_SERVICE_TOKEN');

export interface INotificationService {
  sendUpcomingNotification(backgroundJob: BackgroundJobEntity): Promise<void>;
  sendOverdueNotification(backgroundJob: BackgroundJobEntity): Promise<void>;
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/modules/worker/notification-service.interface.ts
git commit -m "feat: add INotificationService abstraction token for WorkerProcessor"
```

---

### Task 5: Create `WorkerProcessor` with unit tests

**Files:**
- Create: `backend/src/modules/worker/worker.processor.ts`
- Create: `backend/src/modules/worker/worker.processor.spec.ts`

- [ ] **Step 1: Write the failing test**

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

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend && pnpm exec vitest run src/modules/worker/worker.processor.spec.ts
```

Expected: FAIL — `WorkerProcessor` not found.

- [ ] **Step 3: Create `WorkerProcessor`**

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

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd backend && pnpm exec vitest run src/modules/worker/worker.processor.spec.ts
```

Expected: PASS — all 7 tests green.

- [ ] **Step 5: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [ ] **Step 6: Commit**

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

- [ ] **Step 1: Create `notification-service.stub.ts`**

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

- [ ] **Step 2: Create `WorkerModule`**

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

- [ ] **Step 3: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [ ] **Step 4: Commit**

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

- [ ] **Step 1: Create `main-worker.ts`**

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

- [ ] **Step 2: Update `docker-compose.yml` with the worker service**

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

- [ ] **Step 3: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [ ] **Step 4: Commit**

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

- [ ] **Step 1: Add failing test for job cancellation in `markDone`**

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

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend && pnpm exec vitest run src/modules/maintenance-card/services/maintenance-card.service.spec.ts
```

Expected: FAIL — `BackgroundJobRepository` not provided or `cancelJobsForCard` not called.

- [ ] **Step 3: Import `BackgroundJobModule` into `MaintenanceCardModule`**

In `backend/src/modules/maintenance-card/maintenance-card.module.ts`, add `BackgroundJobModule` to imports:

```typescript
import { BackgroundJobModule } from 'src/modules/background-job/background-job.module';
```

Add `BackgroundJobModule` to the `imports` array alongside existing imports. Do not replace the file — only add the import.

- [ ] **Step 4: Update `MaintenanceCardService` to inject and call `cancelJobsForCard`**

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

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd backend && pnpm exec vitest run src/modules/maintenance-card/services/maintenance-card.service.spec.ts
```

Expected: PASS — all tests green.

- [ ] **Step 6: Run all unit tests**

```bash
just test-unit
```

Expected: All tests pass.

- [ ] **Step 7: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add backend/src/modules/maintenance-card/maintenance-card.module.ts \
        backend/src/modules/maintenance-card/services/maintenance-card.service.ts \
        backend/src/modules/maintenance-card/services/maintenance-card.service.spec.ts
git commit -m "feat: cancel background jobs for card on markDone (deferred from Plan 06)"
```

---

## Chunk 6: Build Verification

### Task 9: Build and smoke test

- [ ] **Step 1: Build all workspaces**

```bash
just build
```

Expected: No TypeScript errors. `backend/dist/main-worker.js` is produced.

- [ ] **Step 2: Run the full unit test suite**

```bash
just test-unit
```

Expected: All tests pass.

- [ ] **Step 3: Start all services and verify worker comes online**

```bash
just up-build
docker compose logs worker --follow
```

Expected: NestJS bootstrap logs appear from the worker container. No Redis or Postgres `ECONNREFUSED` errors. Worker sits idle waiting for queue messages.
