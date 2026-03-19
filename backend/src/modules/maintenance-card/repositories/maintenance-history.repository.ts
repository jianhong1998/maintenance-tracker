import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { MaintenanceHistoryEntity } from 'src/db/entities/maintenance-history.entity';
import { BaseDBUtil } from 'src/modules/common/base-classes/base-db-util';

export type CreateHistoryData = {
  maintenanceCardId: string;
  doneAtMileage: number | null;
  doneAtDate: Date;
  notes: string | null;
};

@Injectable()
export class MaintenanceHistoryRepository extends BaseDBUtil<
  MaintenanceHistoryEntity,
  CreateHistoryData
> {
  constructor(
    @InjectRepository(MaintenanceHistoryEntity)
    private readonly historyRepo: Repository<MaintenanceHistoryEntity>,
  ) {
    super(MaintenanceHistoryEntity, historyRepo);
  }

  async create(params: {
    creationData: CreateHistoryData;
    entityManager?: EntityManager;
  }): Promise<MaintenanceHistoryEntity> {
    const { creationData, entityManager } = params;
    const repo =
      (entityManager?.getRepository(
        MaintenanceHistoryEntity,
      ) as Repository<MaintenanceHistoryEntity>) ?? this.historyRepo;

    const record = repo.create(creationData);
    return await repo.save(record);
  }

  async findByCardId(
    maintenanceCardId: string,
  ): Promise<MaintenanceHistoryEntity[]> {
    return this.historyRepo.find({
      where: { maintenanceCardId },
      order: { doneAtDate: 'DESC', createdAt: 'DESC' },
    });
  }
}
