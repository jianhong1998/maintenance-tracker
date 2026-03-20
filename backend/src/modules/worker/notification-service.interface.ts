import type { BackgroundJobEntity } from 'src/db/entities/background-job.entity';

export const NOTIFICATION_SERVICE_TOKEN = Symbol('NOTIFICATION_SERVICE_TOKEN');

export interface INotificationService {
  sendUpcomingNotification(backgroundJob: BackgroundJobEntity): Promise<void>;
  sendOverdueNotification(backgroundJob: BackgroundJobEntity): Promise<void>;
}
