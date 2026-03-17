import { Injectable, NotFoundException } from '@nestjs/common';
import { VehicleEntity, MileageUnit } from 'src/db/entities/vehicle.entity';
import { VehicleRepository } from '../repositories/vehicle.repository';

export type CreateVehicleInput = {
  brand: string;
  model: string;
  colour: string;
  mileage: number;
  mileageUnit: MileageUnit;
};

export type UpdateVehicleInput = {
  brand?: string;
  model?: string;
  colour?: string;
  mileage?: number;
  mileageUnit?: MileageUnit;
};

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
    input: CreateVehicleInput,
  ): Promise<VehicleEntity> {
    return this.vehicleRepository.create({
      creationData: { userId, ...input },
    });
  }

  async updateVehicle(
    id: string,
    userId: string,
    input: UpdateVehicleInput,
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
    await this.vehicleRepository.delete({ criteria: { id, userId } });
  }
}
