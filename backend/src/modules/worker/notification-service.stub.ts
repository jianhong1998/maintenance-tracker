import { Injectable, Logger } from '@nestjs/common';
import type { BackgroundJobEntity } from 'src/db/entities/background-job.entity';
import { INotificationService } from './notification-service.interface';

/**
 * Stub implementation used until Plan 09 wires the real NotificationModule.
 * Logs a warning so it is obvious in dev that emails are not being sent.
 */
@Injectable()
export class NotificationServiceStub implements INotificationService {
  private readonly logger = new Logger(NotificationServiceStub.name);

  sendUpcomingNotification(backgroundJob: BackgroundJobEntity): Promise<void> {
    this.logger.warn(
      `[STUB] sendUpcomingNotification called for BackgroundJob ${backgroundJob.id} — not implemented yet`,
    );
    return Promise.resolve();
  }

  sendOverdueNotification(backgroundJob: BackgroundJobEntity): Promise<void> {
    this.logger.warn(
      `[STUB] sendOverdueNotification called for BackgroundJob ${backgroundJob.id} — not implemented yet`,
    );
    return Promise.resolve();
  }
}
