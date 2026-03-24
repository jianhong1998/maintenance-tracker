import { Module } from '@nestjs/common';
import { BackgroundJobModule } from 'src/modules/background-job/background-job.module';
import { QueueModule } from 'src/modules/queue/queue.module';
import { AppConfig } from 'src/configs/app.config';
import { NotificationModule } from 'src/modules/notification/notification.module';
import { WorkerProcessor } from './worker.processor';

@Module({
  imports: [
    AppConfig.configModule,
    AppConfig.typeormModule,
    AppConfig.bullModule,
    QueueModule,
    BackgroundJobModule,
    NotificationModule,
  ],
  providers: [WorkerProcessor],
})
export class WorkerModule {}
