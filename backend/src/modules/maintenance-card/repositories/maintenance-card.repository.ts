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
  nextDueMileage: number | null;
  nextDueDate: Date | null;
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

  async getOneWithDeleted(
    id: string,
    vehicleId: string,
  ): Promise<MaintenanceCardEntity | null> {
    return this.cardRepo.findOne({
      where: { id, vehicleId },
      withDeleted: true,
    });
  }

  // Returns both overdue and upcoming cards in one query; caller distinguishes
  // job type by comparing nextDueDate to today.
  async findCardsForNotification(
    notificationDaysBefore: number,
  ): Promise<MaintenanceCardEntity[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + notificationDaysBefore);
    const cutoffDateStr = cutoffDate.toISOString().slice(0, 10); // 'YYYY-MM-DD'

    return this.cardRepo
      .createQueryBuilder('card')
      .where('card.nextDueDate IS NOT NULL')
      .andWhere('card.nextDueDate <= :cutoffDate', {
        cutoffDate: cutoffDateStr,
      })
      .getMany();
  }
}
