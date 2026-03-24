import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BackgroundJobModule } from 'src/modules/background-job/background-job.module';
import { MaintenanceCardModule } from 'src/modules/maintenance-card/maintenance-card.module';
import { QueueModule } from 'src/modules/queue/queue.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [
    ConfigModule,
    QueueModule,
    BackgroundJobModule,
    MaintenanceCardModule,
  ],
  providers: [SchedulerService],
})
export class SchedulerModule {}
