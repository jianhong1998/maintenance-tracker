import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  BackgroundJobEntity,
  BackgroundJobStatus,
} from 'src/db/entities/background-job.entity';
import { BackgroundJobRepository } from 'src/modules/background-job/repositories/background-job.repository';
import type { INotificationService } from './notification-service.interface';
import { NOTIFICATION_SERVICE_TOKEN } from './notification-service.interface';
import { JOB_TYPES } from '../background-job/enums/job-type.enum';

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
    if (backgroundJob.expiresAt <= new Date()) {
      this.logger.log(
        `BackgroundJob ${backgroundJobId} TTL expired — marking done (stale fast-path)`,
      );
      await this.backgroundJobRepository.updateStatus(
        backgroundJobId,
        BackgroundJobStatus.DONE,
      );
      return;
    }

    await this.backgroundJobRepository.updateStatus(
      backgroundJobId,
      BackgroundJobStatus.PROCESSING,
    );

    try {
      await this.dispatch(backgroundJob);
      await this.backgroundJobRepository.updateStatus(
        backgroundJobId,
        BackgroundJobStatus.DONE,
      );
    } catch (err) {
      this.logger.error(
        `BackgroundJob ${backgroundJobId} failed: ${(err as Error).message}`,
      );
      await this.backgroundJobRepository.updateStatus(
        backgroundJobId,
        BackgroundJobStatus.FAILED,
      );
      throw err;
    }
  }

  private async dispatch(backgroundJob: BackgroundJobEntity): Promise<void> {
    switch (backgroundJob.jobType) {
      case JOB_TYPES.notificationUpcoming:
        await this.notificationService.sendUpcomingNotification(backgroundJob);
        break;
      case JOB_TYPES.notificationOverdue:
        await this.notificationService.sendOverdueNotification(backgroundJob);
        break;
      default:
        throw new Error(`Unknown job type "${backgroundJob.jobType}"`);
    }
  }
}
