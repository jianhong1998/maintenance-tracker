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
import { NOTIFICATION_SERVICE_TOKEN } from './notification-service.interface';

const mockBackgroundJobRepository = {
  getOne: vi.fn(),
  updateStatus: vi.fn(),
};

const mockNotificationService = {
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
      expect(
        mockNotificationService.sendUpcomingNotification,
      ).not.toHaveBeenCalled();
    });

    it('skips silently when job status is not pending', async () => {
      const job = {
        id: 'job-1',
        status: BackgroundJobStatus.DONE,
        jobType: 'notification.upcoming',
        expiresAt: new Date(Date.now() + 86400000),
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
        expiresAt: new Date(Date.now() - 1000),
      } as BackgroundJobEntity;
      mockBackgroundJobRepository.getOne.mockResolvedValue(job);
      mockBackgroundJobRepository.updateStatus.mockResolvedValue(undefined);

      await processor.process(makeJob('job-1'));

      expect(mockBackgroundJobRepository.updateStatus).toHaveBeenCalledWith(
        'job-1',
        BackgroundJobStatus.DONE,
      );
      expect(
        mockNotificationService.sendUpcomingNotification,
      ).not.toHaveBeenCalled();
    });

    it('processes notification.upcoming job successfully', async () => {
      const backgroundJob = {
        id: 'job-1',
        status: BackgroundJobStatus.PENDING,
        jobType: 'notification.upcoming',
        expiresAt: new Date(Date.now() + 86400000),
      } as BackgroundJobEntity;
      mockBackgroundJobRepository.getOne.mockResolvedValue(backgroundJob);
      mockBackgroundJobRepository.updateStatus.mockResolvedValue(undefined);
      vi.mocked(
        mockNotificationService.sendUpcomingNotification,
      ).mockResolvedValue(undefined);

      await processor.process(makeJob('job-1'));

      expect(mockBackgroundJobRepository.updateStatus).toHaveBeenCalledWith(
        'job-1',
        BackgroundJobStatus.PROCESSING,
      );
      expect(
        mockNotificationService.sendUpcomingNotification,
      ).toHaveBeenCalledWith(backgroundJob);
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
        expiresAt: new Date(Date.now() + 86400000),
      } as BackgroundJobEntity;
      mockBackgroundJobRepository.getOne.mockResolvedValue(backgroundJob);
      mockBackgroundJobRepository.updateStatus.mockResolvedValue(undefined);
      vi.mocked(
        mockNotificationService.sendOverdueNotification,
      ).mockResolvedValue(undefined);

      await processor.process(makeJob('job-1'));

      expect(
        mockNotificationService.sendOverdueNotification,
      ).toHaveBeenCalledWith(backgroundJob);
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
        expiresAt: new Date(Date.now() + 86400000),
      } as BackgroundJobEntity;
      mockBackgroundJobRepository.getOne.mockResolvedValue(backgroundJob);
      mockBackgroundJobRepository.updateStatus.mockResolvedValue(undefined);

      await expect(processor.process(makeJob('job-1'))).rejects.toThrow(
        'Unknown job type',
      );

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
        expiresAt: new Date(Date.now() + 86400000),
      } as BackgroundJobEntity;
      mockBackgroundJobRepository.getOne.mockResolvedValue(backgroundJob);
      mockBackgroundJobRepository.updateStatus.mockResolvedValue(undefined);
      const error = new Error('email send failed');
      vi.mocked(
        mockNotificationService.sendUpcomingNotification,
      ).mockRejectedValue(error);

      await expect(processor.process(makeJob('job-1'))).rejects.toThrow(
        'email send failed',
      );

      expect(mockBackgroundJobRepository.updateStatus).toHaveBeenCalledWith(
        'job-1',
        BackgroundJobStatus.FAILED,
      );
    });
  });
});
