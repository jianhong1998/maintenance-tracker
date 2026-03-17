import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleEntity } from 'src/db/entities/vehicle.entity';
import { MaintenanceCardModule } from '../maintenance-card/maintenance-card.module';
import { VehicleRepository } from './repositories/vehicle.repository';
import { VehicleService } from './services/vehicle.service';
import { VehicleController } from './controllers/vehicle.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([VehicleEntity]),
    forwardRef(() => MaintenanceCardModule),
  ],
  providers: [VehicleRepository, VehicleService],
  controllers: [VehicleController],
  exports: [VehicleService],
})
export class VehicleModule {}
