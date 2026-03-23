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

      expect(
        mockBackgroundJobRepository.insertIfNotExists,
      ).not.toHaveBeenCalled();
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

      expect(
        mockBackgroundJobRepository.insertIfNotExists,
      ).toHaveBeenCalledWith(
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

      expect(
        mockBackgroundJobRepository.insertIfNotExists,
      ).toHaveBeenCalledWith(
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

      const callArg = mockBackgroundJobRepository.insertIfNotExists.mock
        .calls[0][0] as {
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

      const callArg = mockBackgroundJobRepository.insertIfNotExists.mock
        .calls[0][0] as {
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
      mockBackgroundJobRepository.findPendingForRecovery.mockResolvedValue(
        stuckJobs,
      );
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
