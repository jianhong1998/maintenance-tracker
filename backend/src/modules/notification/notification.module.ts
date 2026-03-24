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
