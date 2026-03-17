import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ICreateVehicleReqDTO,
  IUpdateVehicleReqDTO,
} from '@project/types';
import { VehicleEntity } from 'src/db/entities/vehicle.entity';
import { VehicleRepository } from '../repositories/vehicle.repository';
import { MaintenanceCardService } from 'src/modules/maintenance-card/services/maintenance-card.service';

@Injectable()
export class VehicleService {
  constructor(
    private readonly vehicleRepository: VehicleRepository,
    @Inject(forwardRef(() => MaintenanceCardService))
    private readonly maintenanceCardService: MaintenanceCardService,
  ) {}

  async listVehicles(userId: string): Promise<VehicleEntity[]> {
    return this.vehicleRepository.getAll({ criteria: { userId } });
  }

  async getVehicle(id: string, userId: string): Promise<VehicleEntity> {
    const vehicle = await this.vehicleRepository.getOne({
      criteria: { id, userId },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }

  async createVehicle(
    userId: string,
    input: ICreateVehicleReqDTO,
  ): Promise<VehicleEntity> {
    return this.vehicleRepository.create({
      creationData: { userId, ...input },
    });
  }

  async updateVehicle(
    id: string,
    userId: string,
    input: IUpdateVehicleReqDTO,
  ): Promise<VehicleEntity> {
    const vehicle = await this.getVehicle(id, userId);
    Object.assign(vehicle, input);
    const [updated] = await this.vehicleRepository.updateWithSave({
      dataArray: [vehicle],
    });
    return updated;
  }

  async deleteVehicle(id: string, userId: string): Promise<void> {
    await this.getVehicle(id, userId);
    await this.maintenanceCardService.deleteCardsByVehicleId(id);
    await this.vehicleRepository.delete({ criteria: { id, userId } });
  }
}
