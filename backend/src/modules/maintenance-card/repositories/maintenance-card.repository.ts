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

  async getOneWithDeleted(
    id: string,
    vehicleId: string,
  ): Promise<MaintenanceCardEntity | null> {
    return this.cardRepo.findOne({
      where: { id, vehicleId },
      withDeleted: true,
    });
  }

  /**
   * Returns non-deleted cards whose nextDueDate is not null and falls on or
   * before today + notificationDaysBefore. This captures both overdue cards
   * (nextDueDate < today) and upcoming cards (nextDueDate within the window).
   * The caller decides which job type to create based on the date comparison.
   */
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
      .andWhere('card.deletedAt IS NULL')
      .getMany();
  }
}
