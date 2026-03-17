import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import type { ICreateVehicleReqDTO } from '@project/types';
import { VehicleEntity } from 'src/db/entities/vehicle.entity';
import { BaseDBUtil } from 'src/modules/common/base-classes/base-db-util';

export type CreateVehicleData = ICreateVehicleReqDTO & { userId: string };

@Injectable()
export class VehicleRepository extends BaseDBUtil<
  VehicleEntity,
  CreateVehicleData
> {
  constructor(
    @InjectRepository(VehicleEntity)
    private readonly vehicleRepo: Repository<VehicleEntity>,
  ) {
    super(VehicleEntity, vehicleRepo);
  }

  async create(params: {
    creationData: CreateVehicleData;
    entityManager?: EntityManager;
  }): Promise<VehicleEntity> {
    const { creationData, entityManager } = params;
    const repo =
      (entityManager?.getRepository(
        VehicleEntity,
      ) as Repository<VehicleEntity>) ?? this.vehicleRepo;

    const vehicle = repo.create(creationData);
    return await repo.save(vehicle);
  }
}
