import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { MaintenanceCardEntity } from 'src/db/entities/maintenance-card.entity';
import type { MaintenanceCardType } from '@project/types';
import { BaseDBUtil } from 'src/modules/common/base-classes/base-db-util';

export type CreateMaintenanceCardData = {
  vehicleId: string;
  type: MaintenanceCardType;
  name: string;
  description: string | null;
  intervalMileage: number | null;
  intervalTimeMonths: number | null;
};

@Injectable()
export class MaintenanceCardRepository extends BaseDBUtil<
  MaintenanceCardEntity,
  CreateMaintenanceCardData
> {
  constructor(
    @InjectRepository(MaintenanceCardEntity)
    private readonly cardRepo: Repository<MaintenanceCardEntity>,
  ) {
    super(MaintenanceCardEntity, cardRepo);
  }

  async create(params: {
    creationData: CreateMaintenanceCardData;
    entityManager?: EntityManager;
  }): Promise<MaintenanceCardEntity> {
    const { creationData, entityManager } = params;
    const repo =
      (entityManager?.getRepository(
        MaintenanceCardEntity,
      ) as Repository<MaintenanceCardEntity>) ?? this.cardRepo;

    const card = repo.create(creationData);
    return await repo.save(card);
  }

  async getOneWithDeleted(params: {
    criteria: { id: string; vehicleId: string };
  }): Promise<MaintenanceCardEntity | null> {
    const { criteria } = params;
    return this.cardRepo.findOne({
      where: { id: criteria.id, vehicleId: criteria.vehicleId },
      withDeleted: true,
    });
  }
}
