import { Module } from '@nestjs/common';
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
