import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ICreateVehicleReqDTO,
  IUpdateVehicleReqDTO,
} from '@project/types';
import { VehicleEntity } from 'src/db/entities/vehicle.entity';
import { VehicleRepository } from '../repositories/vehicle.repository';

@Injectable()
export class VehicleService {
  constructor(private readonly vehicleRepository: VehicleRepository) {}

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
    // Intentionally does NOT update mileageLastUpdatedAt — only recordMileage does.
    // Editing vehicle details from the settings form should not suppress the daily mileage prompt.
    if (input.mileage !== undefined) {
      this.validateMileageNotDecreased(input.mileage, vehicle.mileage);
    }
    Object.assign(vehicle, input);
    const [updated] = await this.vehicleRepository.updateWithSave({
      dataArray: [vehicle],
    });
    return updated;
  }

  async recordMileage(params: {
    id: string;
    userId: string;
    mileage: number;
  }): Promise<VehicleEntity> {
    const { id, userId, mileage } = params;
    const vehicle = await this.getVehicle(id, userId);
    this.validateMileageNotDecreased(mileage, vehicle.mileage);
    vehicle.mileage = mileage;
    vehicle.mileageLastUpdatedAt = new Date();
    const [updated] = await this.vehicleRepository.updateWithSave({
      dataArray: [vehicle],
    });
    return updated;
  }

  private validateMileageNotDecreased(
    newMileage: number,
    currentMileage: number,
  ): void {
    if (newMileage < currentMileage) {
      throw new BadRequestException(
        'New mileage cannot be less than the current mileage',
      );
    }
  }

  async deleteVehicle(id: string, userId: string): Promise<void> {
    const result = await this.vehicleRepository.delete({
      criteria: { id, userId },
      relation: { maintenanceCards: true },
    });
    if (!result) throw new NotFoundException('Vehicle not found');
  }
}
