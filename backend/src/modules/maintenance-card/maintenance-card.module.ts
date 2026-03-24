import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaintenanceCardEntity } from 'src/db/entities/maintenance-card.entity';
import { MaintenanceHistoryEntity } from 'src/db/entities/maintenance-history.entity';
import { VehicleModule } from '../vehicle/vehicle.module';
import { BackgroundJobModule } from 'src/modules/background-job/background-job.module';
import { MaintenanceCardRepository } from './repositories/maintenance-card.repository';
import { MaintenanceHistoryRepository } from './repositories/maintenance-history.repository';
import { MaintenanceCardService } from './services/maintenance-card.service';
import { MaintenanceHistoryService } from './services/maintenance-history.service';
import { MaintenanceCardController } from './controllers/maintenance-card.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([MaintenanceCardEntity, MaintenanceHistoryEntity]),
    VehicleModule,
    BackgroundJobModule,
  ],
  providers: [
    MaintenanceCardRepository,
    MaintenanceHistoryRepository,
    MaintenanceCardService,
    MaintenanceHistoryService,
  ],
  controllers: [MaintenanceCardController],
  exports: [MaintenanceCardService, MaintenanceCardRepository],
})
export class MaintenanceCardModule {}
