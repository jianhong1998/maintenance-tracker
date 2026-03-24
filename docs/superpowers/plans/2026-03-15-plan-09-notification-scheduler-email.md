# Plan 09: Notification Scheduler + Email

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the notification scheduler (cron job that scans due/overdue cards and creates idempotent `BackgroundJob` records) and the real `NotificationService` (replaces the Plan 08 stub, sends emails via Postmark or SES), wiring both into `AppModule` and `WorkerModule` respectively.

**Architecture:** A new `SchedulerModule` (imported by `AppModule`) hosts `SchedulerService` — a `@Cron`-decorated service that queries `MaintenanceCardRepository`, calls `BackgroundJobRepository.insertIfNotExists`, and enqueues BullMQ messages. A new `NotificationModule` (imported by `WorkerModule`) hosts `NotificationService` (implements `INotificationService`) and `EmailService` (switches between Postmark/SES via `EMAIL_PROVIDER` env var). `MaintenanceCardRepository` gains a `findCardsForNotification(daysBefore)` query method. The Plan 08 `NotificationServiceStub` binding is replaced in `WorkerModule` by importing `NotificationModule`.

**Tech Stack:** `@nestjs/schedule`, `postmark`, `@aws-sdk/client-ses`, `@nestjs/bullmq` `InjectQueue`, TypeORM QueryBuilder, Vitest `vi.hoisted`

**Spec reference:** `docs/superpowers/specs/2026-03-14-maintenance-tracker-design.md` — Section 5 (Scheduler, Worker & Notification Logic), Section 8 (Environment Variables)

**Prerequisites:** Plans 01–08 must be complete. `BackgroundJobRepository` (`insertIfNotExists`, `findPendingForRecovery`), `MaintenanceCardRepository`, and `QueueModule` (`'maintenance'` BullMQ queue) are all implemented.

---

## Chunk 1: Dependencies, `findCardsForNotification`, and `SchedulerService`

### Task 1: Install packages and update `.env.template`

**Files:**
- Modify: `backend/package.json` (via pnpm add)
- Modify: `.env.template`

- [ ] **Step 1: Install backend dependencies**

```bash
cd backend && pnpm add @nestjs/schedule postmark @aws-sdk/client-ses
```

Expected: `@nestjs/schedule`, `postmark`, and `@aws-sdk/client-ses` appear in `backend/package.json` dependencies.

- [ ] **Step 2: Update `.env.template` with new variables**

Append to `.env.template`:

```dotenv
# Redis
REDIS_URL=redis://localhost:6379

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_PRIVATE_KEY=your-private-key

# Mileage / notification config
MILEAGE_WARNING_THRESHOLD_KM=500
NOTIFICATION_DAYS_BEFORE=7
NOTIFICATION_CRON_SCHEDULE=0 8 * * *

# Email
EMAIL_PROVIDER=postmark
POSTMARK_API_KEY=your-postmark-api-key
POSTMARK_FROM_ADDRESS=noreply@yourdomain.com
AWS_SES_REGION=ap-southeast-1
AWS_SES_FROM_ADDRESS=noreply@yourdomain.com
```

- [ ] **Step 3: Commit**

```bash
git add backend/package.json backend/pnpm-lock.yaml .env.template
git commit -m "chore: install schedule/email packages and update env template"
```

---

### Task 2: Add `findCardsForNotification` to `MaintenanceCardRepository`

**Files:**
- Modify: `backend/src/modules/maintenance-card/repositories/maintenance-card.repository.ts`
- Modify: `backend/src/modules/maintenance-card/repositories/maintenance-card.repository.spec.ts`

- [ ] **Step 1: Write the failing test**

Add inside `describe('MaintenanceCardRepository', ...)` in `maintenance-card.repository.spec.ts`:

```typescript
describe('#findCardsForNotification', () => {
  it('returns cards with nextDueDate on or before the cutoff date', async () => {
    const cards = [
      { id: 'card-1', nextDueDate: '2026-03-20' },
    ] as MaintenanceCardEntity[];
    mockQueryBuilder.getMany.mockResolvedValue(cards);

    const result = await repository.findCardsForNotification(7);

    expect(result).toEqual(cards);
    expect(mockQueryBuilder.where).toHaveBeenCalledWith('card.nextDueDate IS NOT NULL');
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      'card.nextDueDate <= :cutoffDate',
      expect.objectContaining({ cutoffDate: expect.any(String) }),
    );
  });

  it('returns empty array when no cards match', async () => {
    mockQueryBuilder.getMany.mockResolvedValue([]);

    const result = await repository.findCardsForNotification(7);

    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend && pnpm exec vitest run src/modules/maintenance-card/repositories/maintenance-card.repository.spec.ts
```

Expected: FAIL — `findCardsForNotification` not found.

- [ ] **Step 3: Implement `findCardsForNotification`**

Add the following method to `MaintenanceCardRepository` in `maintenance-card.repository.ts`:

```typescript
/**
 * Returns non-deleted cards whose nextDueDate is not null and falls on or
 * before today + notificationDaysBefore. This captures both overdue cards
 * (nextDueDate < today) and upcoming cards (nextDueDate within the window).
 * The caller decides which job type to create based on the date comparison.
 */
async findCardsForNotification(
  notificationDaysBefore: number,
): Promise<MaintenanceCardEntity[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + notificationDaysBefore);
  const cutoffDateStr = cutoffDate.toISOString().slice(0, 10); // 'YYYY-MM-DD'

  return this.cardRepo
    .createQueryBuilder('card')
    .where('card.nextDueDate IS NOT NULL')
    .andWhere('card.nextDueDate <= :cutoffDate', { cutoffDate: cutoffDateStr })
    .getMany();
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd backend && pnpm exec vitest run src/modules/maintenance-card/repositories/maintenance-card.repository.spec.ts
```

Expected: PASS — all tests green.

- [ ] **Step 5: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/maintenance-card/repositories/maintenance-card.repository.ts \
        backend/src/modules/maintenance-card/repositories/maintenance-card.repository.spec.ts
git commit -m "feat: add findCardsForNotification to MaintenanceCardRepository"
```

---

### Task 3: Create `SchedulerService` with unit tests

**Files:**
- Create: `backend/src/modules/scheduler/scheduler.service.ts`
- Create: `backend/src/modules/scheduler/scheduler.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/modules/scheduler/scheduler.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SchedulerService } from './scheduler.service';
import { MaintenanceCardRepository } from 'src/modules/maintenance-card/repositories/maintenance-card.repository';
import { BackgroundJobRepository } from 'src/modules/background-job/repositories/background-job.repository';
import {
  BackgroundJobEntity,
  BackgroundJobStatus,
} from 'src/db/entities/background-job.entity';
import { MaintenanceCardEntity } from 'src/db/entities/maintenance-card.entity';

const mockCardRepository = {
  findCardsForNotification: vi.fn(),
};

const mockBackgroundJobRepository = {
  insertIfNotExists: vi.fn(),
  findPendingForRecovery: vi.fn(),
};

const mockQueue = {
  add: vi.fn(),
};

const mockConfigService = {
  get: vi.fn(),
};

describe('SchedulerService', () => {
  let service: SchedulerService;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'NOTIFICATION_DAYS_BEFORE') return 7;
      return undefined;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        { provide: MaintenanceCardRepository, useValue: mockCardRepository },
        {
          provide: BackgroundJobRepository,
          useValue: mockBackgroundJobRepository,
        },
        { provide: getQueueToken('maintenance'), useValue: mockQueue },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<SchedulerService>(SchedulerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('#scheduleNotifications', () => {
    it('does nothing when no cards are found', async () => {
      mockCardRepository.findCardsForNotification.mockResolvedValue([]);

      await service.scheduleNotifications(7);

      expect(mockBackgroundJobRepository.insertIfNotExists).not.toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('creates notification.upcoming job and enqueues for card due within window', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);

      const card = {
        id: 'card-1',
        nextDueDate: tomorrowStr,
      } as unknown as MaintenanceCardEntity;
      mockCardRepository.findCardsForNotification.mockResolvedValue([card]);

      const job = { id: 'job-1' } as BackgroundJobEntity;
      mockBackgroundJobRepository.insertIfNotExists.mockResolvedValue(job);
      mockQueue.add.mockResolvedValue(undefined);

      await service.scheduleNotifications(7);

      expect(mockBackgroundJobRepository.insertIfNotExists).toHaveBeenCalledWith(
        expect.objectContaining({
          jobType: 'notification.upcoming',
          referenceId: 'card-1',
          referenceType: 'maintenance_card',
          idempotencyKey: `notification.upcoming:card-1:${tomorrowStr}`,
          payload: { cardId: 'card-1' },
        }),
      );
      expect(mockQueue.add).toHaveBeenCalledWith('process', {
        backgroundJobId: 'job-1',
      });
    });

    it('creates notification.overdue job for overdue card', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);

      const card = {
        id: 'card-1',
        nextDueDate: yesterdayStr,
      } as unknown as MaintenanceCardEntity;
      mockCardRepository.findCardsForNotification.mockResolvedValue([card]);

      const job = { id: 'job-1' } as BackgroundJobEntity;
      mockBackgroundJobRepository.insertIfNotExists.mockResolvedValue(job);
      mockQueue.add.mockResolvedValue(undefined);

      await service.scheduleNotifications(7);

      expect(mockBackgroundJobRepository.insertIfNotExists).toHaveBeenCalledWith(
        expect.objectContaining({
          jobType: 'notification.overdue',
          idempotencyKey: `notification.overdue:card-1:${yesterdayStr}`,
        }),
      );
    });

    it('skips enqueue when insertIfNotExists returns null (duplicate key)', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);

      const card = {
        id: 'card-1',
        nextDueDate: tomorrowStr,
      } as unknown as MaintenanceCardEntity;
      mockCardRepository.findCardsForNotification.mockResolvedValue([card]);
      mockBackgroundJobRepository.insertIfNotExists.mockResolvedValue(null);

      await service.scheduleNotifications(7);

      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('sets TTL to nextDueDate + 30 days for overdue jobs', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);

      const card = {
        id: 'card-1',
        nextDueDate: yesterdayStr,
      } as unknown as MaintenanceCardEntity;
      mockCardRepository.findCardsForNotification.mockResolvedValue([card]);
      mockBackgroundJobRepository.insertIfNotExists.mockResolvedValue({
        id: 'job-1',
      } as BackgroundJobEntity);

      await service.scheduleNotifications(7);

      const callArg = mockBackgroundJobRepository.insertIfNotExists.mock.calls[0][0] as {
        ttl: Date;
        jobType: string;
      };
      expect(callArg.jobType).toBe('notification.overdue');
      const expectedTtl = new Date(`${yesterdayStr}T00:00:00Z`);
      expectedTtl.setDate(expectedTtl.getDate() + 30);
      expect(callArg.ttl.toISOString().slice(0, 10)).toBe(
        expectedTtl.toISOString().slice(0, 10),
      );
    });

    it('sets TTL to nextDueDate for upcoming jobs', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);

      const card = {
        id: 'card-1',
        nextDueDate: tomorrowStr,
      } as unknown as MaintenanceCardEntity;
      mockCardRepository.findCardsForNotification.mockResolvedValue([card]);
      mockBackgroundJobRepository.insertIfNotExists.mockResolvedValue({
        id: 'job-1',
      } as BackgroundJobEntity);

      await service.scheduleNotifications(7);

      const callArg = mockBackgroundJobRepository.insertIfNotExists.mock.calls[0][0] as {
        ttl: Date;
        jobType: string;
      };
      expect(callArg.jobType).toBe('notification.upcoming');
      // TTL for upcoming = nextDueDate (stale once card becomes overdue)
      expect(callArg.ttl.toISOString().slice(0, 10)).toBe(tomorrowStr);
    });
  });

  describe('#recoverStuckJobs', () => {
    it('does nothing when no stuck jobs exist', async () => {
      mockBackgroundJobRepository.findPendingForRecovery.mockResolvedValue([]);

      await service.recoverStuckJobs();

      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('re-enqueues all stuck pending/processing jobs', async () => {
      const stuckJobs = [
        {
          id: 'job-1',
          status: BackgroundJobStatus.PENDING,
        },
        {
          id: 'job-2',
          status: BackgroundJobStatus.PROCESSING,
        },
      ] as BackgroundJobEntity[];
      mockBackgroundJobRepository.findPendingForRecovery.mockResolvedValue(stuckJobs);
      mockQueue.add.mockResolvedValue(undefined);

      await service.recoverStuckJobs();

      expect(mockQueue.add).toHaveBeenCalledTimes(2);
      expect(mockQueue.add).toHaveBeenCalledWith('process', {
        backgroundJobId: 'job-1',
      });
      expect(mockQueue.add).toHaveBeenCalledWith('process', {
        backgroundJobId: 'job-2',
      });
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend && pnpm exec vitest run src/modules/scheduler/scheduler.service.spec.ts
```

Expected: FAIL — `SchedulerService` not found.

- [ ] **Step 3: Create `SchedulerService`**

Create `backend/src/modules/scheduler/scheduler.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { MaintenanceCardRepository } from 'src/modules/maintenance-card/repositories/maintenance-card.repository';
import { BackgroundJobRepository } from 'src/modules/background-job/repositories/background-job.repository';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly cardRepository: MaintenanceCardRepository,
    private readonly backgroundJobRepository: BackgroundJobRepository,
    @InjectQueue('maintenance') private readonly maintenanceQueue: Queue,
    private readonly configService: ConfigService,
  ) {}

  @Cron(process.env['NOTIFICATION_CRON_SCHEDULE'] ?? '0 8 * * *')
  async runNotificationSchedule(): Promise<void> {
    const notificationDaysBefore =
      this.configService.get<number>('NOTIFICATION_DAYS_BEFORE') ?? 7;

    await this.scheduleNotifications(notificationDaysBefore);
    await this.recoverStuckJobs();
  }

  async scheduleNotifications(notificationDaysBefore: number): Promise<void> {
    const todayStr = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
    const cards = await this.cardRepository.findCardsForNotification(notificationDaysBefore);

    for (const card of cards) {
      const nextDueDateStr = String(card.nextDueDate).slice(0, 10);
      const isOverdue = nextDueDateStr < todayStr;
      const jobType = isOverdue ? 'notification.overdue' : 'notification.upcoming';
      const idempotencyKey = `${jobType}:${card.id}:${nextDueDateStr}`;

      // TTL: upcoming → stale at due date (overdue job takes over)
      // TTL: overdue → 30-day grace window from due date
      const nextDueDateObj = new Date(`${nextDueDateStr}T00:00:00Z`);
      const ttl = isOverdue
        ? new Date(nextDueDateObj.getTime() + 30 * 24 * 60 * 60 * 1000)
        : nextDueDateObj;

      const job = await this.backgroundJobRepository.insertIfNotExists({
        jobType,
        referenceId: card.id,
        referenceType: 'maintenance_card',
        idempotencyKey,
        payload: { cardId: card.id },
        scheduledFrom: new Date(),
        ttl,
      });

      if (job) {
        await this.maintenanceQueue.add('process', { backgroundJobId: job.id });
        this.logger.log(
          `Enqueued ${jobType} job ${job.id} for card ${card.id}`,
        );
      }
    }
  }

  async recoverStuckJobs(): Promise<void> {
    const stuckJobs = await this.backgroundJobRepository.findPendingForRecovery();

    for (const job of stuckJobs) {
      await this.maintenanceQueue.add('process', { backgroundJobId: job.id });
      this.logger.log(
        `Re-enqueued stuck job ${job.id} (status: ${job.status})`,
      );
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd backend && pnpm exec vitest run src/modules/scheduler/scheduler.service.spec.ts
```

Expected: PASS — all 8 tests green.

- [ ] **Step 5: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/scheduler/scheduler.service.ts \
        backend/src/modules/scheduler/scheduler.service.spec.ts
git commit -m "feat: add SchedulerService with cron-driven notification job scheduling"
```

---

### Task 4: Create `SchedulerModule` and register in `AppModule`

**Files:**
- Create: `backend/src/modules/scheduler/scheduler.module.ts`
- Modify: `backend/src/modules/app/app.module.ts`

- [ ] **Step 1: Create `SchedulerModule`**

Create `backend/src/modules/scheduler/scheduler.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BackgroundJobModule } from 'src/modules/background-job/background-job.module';
import { MaintenanceCardModule } from 'src/modules/maintenance-card/maintenance-card.module';
import { QueueModule } from 'src/modules/queue/queue.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [ConfigModule, QueueModule, BackgroundJobModule, MaintenanceCardModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
```

- [ ] **Step 2: Register `SchedulerModule` and `ScheduleModule.forRoot()` in `AppModule`**

In `backend/src/modules/app/app.module.ts`, add the following imports at the top:

```typescript
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SchedulerModule } from '../scheduler/scheduler.module';
```

Then update `AppModule` to add `ScheduleModule.forRoot()`, `BullModule.forRootAsync`, and `SchedulerModule` to the `imports` array:

```typescript
@Module({
  imports: [
    AppConfig.configModule,
    AppConfig.typeormModule,
    CommonModule,
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          url: configService.get<string>('REDIS_URL'),
        },
      }),
    }),
    SchedulerModule,
    // Previously added modules (AuthModule, VehicleModule, etc.) go here
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

Do not remove previously-added modules (AuthModule, VehicleModule, MaintenanceCardModule, ConfigModule as AppConfigModule, etc.) — only add the new imports alongside them.

- [ ] **Step 3: Run all unit tests**

```bash
just test-unit
```

Expected: All tests pass.

- [ ] **Step 4: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/scheduler/scheduler.module.ts \
        backend/src/modules/app/app.module.ts
git commit -m "feat: add SchedulerModule and wire cron schedule into AppModule"
```

---

## Chunk 2: `EmailService`, `NotificationService`, and `NotificationModule`

### Task 5: Create `EmailService` with unit tests

**Files:**
- Create: `backend/src/modules/notification/email.service.ts`
- Create: `backend/src/modules/notification/email.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/modules/notification/email.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const { mockSendEmail, mockSend } = vi.hoisted(() => ({
  mockSendEmail: vi.fn().mockResolvedValue({}),
  mockSend: vi.fn().mockResolvedValue({}),
}));

vi.mock('postmark', () => ({
  ServerClient: vi.fn().mockImplementation(() => ({ sendEmail: mockSendEmail })),
}));

vi.mock('@aws-sdk/client-ses', () => ({
  SESClient: vi.fn().mockImplementation(() => ({ send: mockSend })),
  SendEmailCommand: vi.fn().mockImplementation((input: unknown) => input),
}));

import { EmailService } from './email.service';

const mockConfigService = {
  get: vi.fn(),
};

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('#sendEmail', () => {
    it('sends via Postmark when EMAIL_PROVIDER is "postmark"', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'EMAIL_PROVIDER') return 'postmark';
        if (key === 'POSTMARK_API_KEY') return 'test-key';
        if (key === 'POSTMARK_FROM_ADDRESS') return 'from@example.com';
        return undefined;
      });

      await service.sendEmail({
        to: 'user@example.com',
        subject: 'Test Subject',
        body: 'Test body',
      });

      expect(mockSendEmail).toHaveBeenCalledWith({
        From: 'from@example.com',
        To: 'user@example.com',
        Subject: 'Test Subject',
        TextBody: 'Test body',
      });
    });

    it('sends via SES when EMAIL_PROVIDER is "ses"', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'EMAIL_PROVIDER') return 'ses';
        if (key === 'AWS_SES_REGION') return 'ap-southeast-1';
        if (key === 'AWS_SES_FROM_ADDRESS') return 'from@example.com';
        return undefined;
      });

      await service.sendEmail({
        to: 'user@example.com',
        subject: 'Test Subject',
        body: 'Test body',
      });

      expect(mockSend).toHaveBeenCalled();
    });

    it('does not throw and logs a warning for unknown EMAIL_PROVIDER', async () => {
      mockConfigService.get.mockReturnValue('unknown-provider');

      await expect(
        service.sendEmail({
          to: 'user@example.com',
          subject: 'Test Subject',
          body: 'Test body',
        }),
      ).resolves.toBeUndefined();

      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(mockSend).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend && pnpm exec vitest run src/modules/notification/email.service.spec.ts
```

Expected: FAIL — `EmailService` not found.

- [ ] **Step 3: Create `EmailService`**

Create `backend/src/modules/notification/email.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as postmark from 'postmark';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendEmail(params: SendEmailParams): Promise<void> {
    const provider = this.configService.get<string>('EMAIL_PROVIDER');

    if (provider === 'postmark') {
      await this.sendViaPostmark(params);
    } else if (provider === 'ses') {
      await this.sendViaSes(params);
    } else {
      this.logger.warn(
        `Unknown EMAIL_PROVIDER "${provider ?? 'undefined'}" — email not sent`,
      );
    }
  }

  private async sendViaPostmark(params: SendEmailParams): Promise<void> {
    const apiKey = this.configService.get<string>('POSTMARK_API_KEY') ?? '';
    const from =
      this.configService.get<string>('POSTMARK_FROM_ADDRESS') ?? '';

    const client = new postmark.ServerClient(apiKey);
    await client.sendEmail({
      From: from,
      To: params.to,
      Subject: params.subject,
      TextBody: params.body,
    });
  }

  private async sendViaSes(params: SendEmailParams): Promise<void> {
    const region = this.configService.get<string>('AWS_SES_REGION');
    const from =
      this.configService.get<string>('AWS_SES_FROM_ADDRESS') ?? '';

    const client = new SESClient({ region });
    await client.send(
      new SendEmailCommand({
        Source: from,
        Destination: { ToAddresses: [params.to] },
        Message: {
          Subject: { Data: params.subject },
          Body: { Text: { Data: params.body } },
        },
      }),
    );
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd backend && pnpm exec vitest run src/modules/notification/email.service.spec.ts
```

Expected: PASS — all 4 tests green.

- [ ] **Step 5: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/notification/email.service.ts \
        backend/src/modules/notification/email.service.spec.ts
git commit -m "feat: add EmailService with Postmark/SES provider switching"
```

---

### Task 6: Create `NotificationService` with unit tests

**Files:**
- Create: `backend/src/modules/notification/notification.service.ts`
- Create: `backend/src/modules/notification/notification.service.spec.ts`

`NotificationService` implements `INotificationService` from Plan 08. It looks up the `MaintenanceCard` (with `vehicle` and `vehicle.user` relations, using `withDeleted: true` since the card may be soft-deleted) via the `referenceId` from the `BackgroundJobEntity`, then sends the appropriate email via `EmailService`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/modules/notification/notification.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NotificationService } from './notification.service';
import { EmailService } from './email.service';
import { MaintenanceCardEntity } from 'src/db/entities/maintenance-card.entity';
import { BackgroundJobEntity } from 'src/db/entities/background-job.entity';

const mockEmailService = {
  sendEmail: vi.fn(),
};

const buildCard = (overrides: Partial<MaintenanceCardEntity> = {}): MaintenanceCardEntity =>
  ({
    id: 'card-1',
    name: 'Oil Change',
    nextDueDate: '2026-04-01' as unknown as Date,
    vehicle: {
      id: 'vehicle-1',
      brand: 'Toyota',
      model: 'Corolla',
      user: {
        id: 'user-1',
        email: 'user@example.com',
      },
    },
    ...overrides,
  }) as unknown as MaintenanceCardEntity;

const buildJob = (referenceId: string): BackgroundJobEntity =>
  ({ id: 'job-1', referenceId }) as BackgroundJobEntity;

const mockCardRepo = {
  findOne: vi.fn(),
};

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: EmailService, useValue: mockEmailService },
        {
          provide: getRepositoryToken(MaintenanceCardEntity),
          useValue: mockCardRepo,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('#sendUpcomingNotification', () => {
    it('fetches card with vehicle+user relations and sends upcoming email', async () => {
      const card = buildCard();
      mockCardRepo.findOne.mockResolvedValue(card);
      mockEmailService.sendEmail.mockResolvedValue(undefined);

      await service.sendUpcomingNotification(buildJob('card-1'));

      expect(mockCardRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'card-1' },
        relations: ['vehicle', 'vehicle.user'],
        withDeleted: true,
      });
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith({
        to: 'user@example.com',
        subject: expect.stringContaining('Oil Change'),
        body: expect.stringContaining('Toyota'),
      });
    });

    it('throws when card is not found', async () => {
      mockCardRepo.findOne.mockResolvedValue(null);

      await expect(
        service.sendUpcomingNotification(buildJob('missing-card')),
      ).rejects.toThrow('MaintenanceCard missing-card not found');
    });
  });

  describe('#sendOverdueNotification', () => {
    it('fetches card with vehicle+user relations and sends overdue email', async () => {
      const card = buildCard();
      mockCardRepo.findOne.mockResolvedValue(card);
      mockEmailService.sendEmail.mockResolvedValue(undefined);

      await service.sendOverdueNotification(buildJob('card-1'));

      expect(mockEmailService.sendEmail).toHaveBeenCalledWith({
        to: 'user@example.com',
        subject: expect.stringContaining('Oil Change'),
        body: expect.stringContaining('overdue'),
      });
    });

    it('throws when card is not found', async () => {
      mockCardRepo.findOne.mockResolvedValue(null);

      await expect(
        service.sendOverdueNotification(buildJob('missing-card')),
      ).rejects.toThrow('MaintenanceCard missing-card not found');
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend && pnpm exec vitest run src/modules/notification/notification.service.spec.ts
```

Expected: FAIL — `NotificationService` not found.

- [ ] **Step 3: Create `NotificationService`**

Create `backend/src/modules/notification/notification.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MaintenanceCardEntity } from 'src/db/entities/maintenance-card.entity';
import { BackgroundJobEntity } from 'src/db/entities/background-job.entity';
import { INotificationService } from 'src/modules/worker/notification-service.interface';
import { EmailService } from './email.service';

@Injectable()
export class NotificationService implements INotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(MaintenanceCardEntity)
    private readonly cardRepository: Repository<MaintenanceCardEntity>,
    private readonly emailService: EmailService,
  ) {}

  async sendUpcomingNotification(backgroundJob: BackgroundJobEntity): Promise<void> {
    const card = await this.getCardWithUserOrThrow(backgroundJob.referenceId!);
    const { user } = card.vehicle;

    await this.emailService.sendEmail({
      to: user.email,
      subject: `Maintenance due soon: ${card.name}`,
      body: [
        `Your ${card.vehicle.brand} ${card.vehicle.model} is due for "${card.name}".`,
        `Due date: ${String(card.nextDueDate).slice(0, 10)}.`,
        `Please schedule your maintenance soon.`,
      ].join(' '),
    });

    this.logger.log(
      `Sent upcoming notification for card ${card.id} to ${user.email}`,
    );
  }

  async sendOverdueNotification(backgroundJob: BackgroundJobEntity): Promise<void> {
    const card = await this.getCardWithUserOrThrow(backgroundJob.referenceId!);
    const { user } = card.vehicle;

    await this.emailService.sendEmail({
      to: user.email,
      subject: `Maintenance overdue: ${card.name}`,
      body: [
        `Your ${card.vehicle.brand} ${card.vehicle.model} has overdue maintenance: "${card.name}".`,
        `This was due on ${String(card.nextDueDate).slice(0, 10)}.`,
        `Please schedule your maintenance as soon as possible.`,
      ].join(' '),
    });

    this.logger.log(
      `Sent overdue notification for card ${card.id} to ${user.email}`,
    );
  }

  private async getCardWithUserOrThrow(
    cardId: string,
  ): Promise<MaintenanceCardEntity> {
    const card = await this.cardRepository.findOne({
      where: { id: cardId },
      relations: ['vehicle', 'vehicle.user'],
      withDeleted: true,
    });

    if (!card) {
      throw new Error(`MaintenanceCard ${cardId} not found`);
    }

    return card;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd backend && pnpm exec vitest run src/modules/notification/notification.service.spec.ts
```

Expected: PASS — all 5 tests green.

- [ ] **Step 5: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/notification/notification.service.ts \
        backend/src/modules/notification/notification.service.spec.ts
git commit -m "feat: add NotificationService implementing INotificationService with email dispatch"
```

---

### Task 7: Create `NotificationModule` and update `WorkerModule`

**Files:**
- Create: `backend/src/modules/notification/notification.module.ts`
- Modify: `backend/src/modules/worker/worker.module.ts`

`NotificationModule` provides and exports `NOTIFICATION_SERVICE_TOKEN` bound to the real `NotificationService`. `WorkerModule` is updated to import `NotificationModule` and remove the stub binding.

- [ ] **Step 1: Create `NotificationModule`**

Create `backend/src/modules/notification/notification.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { MaintenanceCardEntity } from 'src/db/entities/maintenance-card.entity';
import { NOTIFICATION_SERVICE_TOKEN } from 'src/modules/worker/notification-service.interface';
import { NotificationService } from './notification.service';
import { EmailService } from './email.service';

@Module({
  imports: [TypeOrmModule.forFeature([MaintenanceCardEntity]), ConfigModule],
  providers: [
    EmailService,
    NotificationService,
    {
      provide: NOTIFICATION_SERVICE_TOKEN,
      useExisting: NotificationService,
    },
  ],
  exports: [NOTIFICATION_SERVICE_TOKEN],
})
export class NotificationModule {}
```

- [ ] **Step 2: Update `WorkerModule` to use `NotificationModule`**

Replace the contents of `backend/src/modules/worker/worker.module.ts` with:

```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BackgroundJobModule } from 'src/modules/background-job/background-job.module';
import { QueueModule } from 'src/modules/queue/queue.module';
import { AppConfig } from 'src/configs/app.config';
import { NotificationModule } from 'src/modules/notification/notification.module';
import { WorkerProcessor } from './worker.processor';

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
    NotificationModule,
  ],
  providers: [WorkerProcessor],
})
export class WorkerModule {}
```

- [ ] **Step 3: Run all unit tests**

```bash
just test-unit
```

Expected: All tests pass.

- [ ] **Step 4: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/notification/notification.module.ts \
        backend/src/modules/worker/worker.module.ts
git commit -m "feat: add NotificationModule and replace WorkerModule stub with real NotificationService"
```

---

## Chunk 3: Build Verification

### Task 8: Build and smoke test

- [ ] **Step 1: Build all workspaces**

```bash
just build
```

Expected: No TypeScript errors. `backend/dist/main.js` and `backend/dist/main-worker.js` both produced.

- [ ] **Step 2: Run the full unit test suite**

```bash
just test-unit
```

Expected: All tests pass.

- [ ] **Step 3: Start all services and verify scheduler and worker boot**

```bash
just up-build
docker compose logs server --follow &
docker compose logs worker --follow
```

Expected:
- `server` container logs show NestJS bootstrap with `SchedulerService` cron registered.
- `worker` container logs show NestJS bootstrap with `WorkerProcessor` listening on the `'maintenance'` queue.
- No `ECONNREFUSED` errors for Redis or Postgres.

- [ ] **Step 4: Manually trigger the scheduler and verify a job is created**

```bash
# Check background_jobs table (should be empty before trigger)
docker exec -it maintenance-tracker-postgres-1 psql -U postgres -d project_db \
  -c "SELECT id, job_type, status, idempotency_key FROM background_jobs LIMIT 10;"
```

Expected: 0 rows initially (no maintenance cards with due dates exist yet).

When cards exist with `next_due_date` values in the window, re-running the scheduler (`runNotificationSchedule` via cron or manual invocation) should insert rows into `background_jobs` and enqueue them.

---

## Post-Implementation Code Review (2026-03-24)

A Linus-style code review was performed after implementation. Three bugs and one refactor opportunity were found and resolved.

### Bug 1: `findCardsForNotification` included soft-deleted cards

**Root cause:** TypeORM's `createQueryBuilder` does **not** automatically apply the soft-delete filter (`deletedAt IS NULL`) the way `find*` methods do. The query was silently returning deleted cards, contradicting the method's own docstring ("Returns non-deleted cards").

**Fix:** Added `.andWhere('card.deletedAt IS NULL')` to the query chain in `maintenance-card.repository.ts`.

**Test added:** `'excludes soft-deleted cards by filtering on deletedAt IS NULL'` in `maintenance-card.repository.spec.ts`.

---

### Bug 2: `EmailService` instantiated HTTP clients on every send

**Root cause:** `sendViaPostmark` and `sendViaSes` called `new postmark.ServerClient(...)` and `new SESClient(...)` inside the method body. Config is static at runtime; there is no reason to pay client initialization cost on every email.

**Fix:** Both clients are now initialized once as `readonly` private fields in the constructor. The `from` address (also static) is still read via `configService.get` at send time since it varies by provider and the tests configure it per-call.

**Tests added** to `email.service.spec.ts`:
- `'does not re-instantiate Postmark client on repeated sends'`
- `'does not re-instantiate SES client on repeated sends'`

These tests track the constructor call count before and after two `sendEmail` calls and assert the count does not increase.

---

### Bug 3: Unknown `EMAIL_PROVIDER` silently swallowed emails

**Root cause:** The `else` branch in `sendEmail` called `this.logger.warn(...)` and returned without sending. A misconfigured `EMAIL_PROVIDER` env var would log a warning that could be missed in production, causing silent email loss with no observable failure.

**Fix:** The `else` branch now throws `new Error('Unknown EMAIL_PROVIDER ...')`, surfacing the misconfiguration as a hard failure.

**Test updated** in `email.service.spec.ts`: renamed from `'does not throw and logs a warning for unknown EMAIL_PROVIDER'` → `'throws for unknown EMAIL_PROVIDER'`; assertion changed from `resolves.toBeUndefined()` → `rejects.toThrow('Unknown EMAIL_PROVIDER')`.

---

### Refactor: Eliminated duplicate send logic in `NotificationService`

**Issue:** `sendUpcomingNotification` and `sendOverdueNotification` were 90% identical — same card fetch, same email dispatch, same logging pattern. Only the subject/body strings differed.

**Fix:** Extracted a private `dispatchNotification(job, { subject, body, logLabel })` helper. Both public methods now delegate to it with their respective string factories.

All existing `notification.service.spec.ts` tests pass unchanged — public behavior is identical.
