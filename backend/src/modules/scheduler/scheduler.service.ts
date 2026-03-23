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
    const cards = await this.cardRepository.findCardsForNotification(
      notificationDaysBefore,
    );

    for (const card of cards) {
      const nextDueDateStr = String(card.nextDueDate).slice(0, 10);
      const isOverdue = nextDueDateStr < todayStr;
      const jobType = isOverdue
        ? 'notification.overdue'
        : 'notification.upcoming';
      const idempotencyKey = `${jobType}:${card.id}:${nextDueDateStr}`;

      // TTL: upcoming → stale at due date (overdue job takes over)
      // TTL: overdue → 30-day grace window from due date
      const nextDueDateObj = new Date(`${nextDueDateStr}T00:00:00Z`);
      const expiresAt = isOverdue
        ? new Date(nextDueDateObj.getTime() + 30 * 24 * 60 * 60 * 1000)
        : nextDueDateObj;

      const job = await this.backgroundJobRepository.insertIfNotExists({
        jobType,
        referenceId: card.id,
        referenceType: 'maintenance_card',
        idempotencyKey,
        payload: { cardId: card.id },
        scheduledFrom: new Date(),
        expiresAt,
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
    const stuckJobs =
      await this.backgroundJobRepository.findPendingForRecovery();

    for (const job of stuckJobs) {
      await this.maintenanceQueue.add('process', { backgroundJobId: job.id });
      this.logger.log(
        `Re-enqueued stuck job ${job.id} (status: ${job.status})`,
      );
    }
  }
}
