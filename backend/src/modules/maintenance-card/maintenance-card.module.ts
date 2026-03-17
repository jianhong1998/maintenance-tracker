import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaintenanceCardEntity } from 'src/db/entities/maintenance-card.entity';
import { VehicleModule } from '../vehicle/vehicle.module';
import { MaintenanceCardRepository } from './repositories/maintenance-card.repository';
import { MaintenanceCardService } from './services/maintenance-card.service';
import { MaintenanceCardController } from './controllers/maintenance-card.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MaintenanceCardEntity]), VehicleModule],
  providers: [MaintenanceCardRepository, MaintenanceCardService],
  controllers: [MaintenanceCardController],
  exports: [MaintenanceCardService],
})
export class MaintenanceCardModule {}
