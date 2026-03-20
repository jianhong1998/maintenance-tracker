import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  BackgroundJobEntity,
  BackgroundJobStatus,
} from 'src/db/entities/background-job.entity';
import { BaseDBUtil } from 'src/modules/common/base-classes/base-db-util';

export type CreateBackgroundJobData = {
  jobType: string;
  referenceId: string | null;
  referenceType: string | null;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  scheduledFrom: Date;
  expiresAt: Date;
};

@Injectable()
export class BackgroundJobRepository extends BaseDBUtil<
  BackgroundJobEntity,
  CreateBackgroundJobData
> {
  constructor(
    @InjectRepository(BackgroundJobEntity)
    private readonly backgroundJobRepo: Repository<BackgroundJobEntity>,
  ) {
    super(BackgroundJobEntity, backgroundJobRepo);
  }

  async create(params: {
    creationData: CreateBackgroundJobData;
    entityManager?: EntityManager;
  }): Promise<BackgroundJobEntity> {
    const { creationData, entityManager } = params;
    const repo =
      (entityManager?.getRepository(
        BackgroundJobEntity,
      ) as Repository<BackgroundJobEntity>) ?? this.backgroundJobRepo;

    const job = repo.create(creationData);
    return await repo.save(job);
  }

  /**
   * INSERT ... ON CONFLICT (idempotency_key) DO NOTHING RETURNING *
   * Returns the inserted row, or null if the idempotency_key already existed.
   */
  async insertIfNotExists(
    data: CreateBackgroundJobData,
  ): Promise<BackgroundJobEntity | null> {
    const result = await this.backgroundJobRepo
      .createQueryBuilder()
      .insert()
      .into(BackgroundJobEntity)
      .values(data)
      .orIgnore()
      .returning('*')
      .execute();

    const rows = result.raw as BackgroundJobEntity[];
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Finds jobs in pending/processing state eligible for recovery:
   * scheduled_from <= now AND expires_at > now
   */
  async findPendingForRecovery(): Promise<BackgroundJobEntity[]> {
    return this.backgroundJobRepo
      .createQueryBuilder('job')
      .where('job.status IN (:...statuses)', {
        statuses: [BackgroundJobStatus.PENDING, BackgroundJobStatus.PROCESSING],
      })
      .andWhere('job.scheduledFrom <= NOW()')
      .andWhere('job.expiresAt > NOW()')
      .getMany();
  }

  /**
   * Updates a single job's status by id.
   */
  async updateStatus(id: string, status: BackgroundJobStatus): Promise<void> {
    await this.backgroundJobRepo
      .createQueryBuilder('job')
      .update(BackgroundJobEntity)
      .set({ status })
      .where('job.id = :id', { id })
      .execute();
  }

  /**
   * Cancels all pending/processing jobs for a maintenance card.
   * Called when a card is marked done or deleted.
   */
  async cancelJobsForCard(cardId: string): Promise<void> {
    await this.backgroundJobRepo
      .createQueryBuilder('job')
      .update(BackgroundJobEntity)
      .set({ status: BackgroundJobStatus.CANCELLED })
      .where('job.referenceType = :referenceType', {
        referenceType: 'maintenance_card',
      })
      .andWhere('job.referenceId = :cardId', { cardId })
      .andWhere('job.status IN (:...statuses)', {
        statuses: [BackgroundJobStatus.PENDING, BackgroundJobStatus.PROCESSING],
      })
      .execute();
  }
}
