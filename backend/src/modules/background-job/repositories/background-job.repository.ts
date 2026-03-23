import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  In,
  LessThanOrEqual,
  MoreThan,
  Repository,
} from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
  BackgroundJobEntity,
  BackgroundJobStatus,
} from 'src/db/entities/background-job.entity';
import { BaseDBUtil } from 'src/modules/common/base-classes/base-db-util';
import { JobType } from '../enums/job-type.enum';

export const BACKGROUND_JOB_REFERENCE_TYPES = {
  maintenanceCard: 'maintenance_card',
} as const;

export type CreateBackgroundJobData = {
  jobType: JobType;
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

  private repoFor(em?: EntityManager): Repository<BackgroundJobEntity> {
    return (
      (em?.getRepository(
        BackgroundJobEntity,
      ) as Repository<BackgroundJobEntity>) ?? this.repo
    );
  }

  async create(params: {
    creationData: CreateBackgroundJobData;
    entityManager?: EntityManager;
  }): Promise<BackgroundJobEntity> {
    const { creationData, entityManager } = params;
    const repo = this.repoFor(entityManager);
    const job = repo.create(creationData);
    return await repo.save(job);
  }

  /**
   * INSERT ... ON CONFLICT (idempotency_key) DO NOTHING RETURNING *
   * Returns the inserted row (hydrated via findOne), or null if the
   * idempotency_key already existed.
   *
   * Note: TypeORM's raw result from .returning('*') uses snake_case DB column
   * names, not camelCase entity properties. We re-fetch with findOne so TypeORM
   * applies its column mapping correctly.
   */
  async insertIfNotExists(
    data: CreateBackgroundJobData,
  ): Promise<BackgroundJobEntity | null> {
    const result = await this.backgroundJobRepo
      .createQueryBuilder()
      .insert()
      .into(BackgroundJobEntity)
      .values(data as QueryDeepPartialEntity<BackgroundJobEntity>)
      .orIgnore()
      .returning('*')
      .execute();

    if ((result.raw as unknown[]).length === 0) return null;

    return this.backgroundJobRepo.findOne({
      where: { idempotencyKey: data.idempotencyKey },
    });
  }

  /**
   * Finds jobs in pending/processing state eligible for recovery:
   * scheduled_from <= now AND expires_at > now
   */
  async findPendingForRecovery(): Promise<BackgroundJobEntity[]> {
    const now = new Date();
    return this.repo.find({
      where: {
        status: In([
          BackgroundJobStatus.PENDING,
          BackgroundJobStatus.PROCESSING,
        ]),
        scheduledFrom: LessThanOrEqual(now),
        expiresAt: MoreThan(now),
      },
    });
  }

  /**
   * Updates a single job's status by id.
   */
  async updateStatus(id: string, status: BackgroundJobStatus): Promise<void> {
    await this.backgroundJobRepo.update({ id }, { status });
  }

  /**
   * Cancels all pending/processing jobs for a maintenance card.
   * Called when a card is marked done or deleted.
   * Pass entityManager to run within an existing transaction.
   */
  async cancelJobsForCard(
    cardId: string,
    entityManager?: EntityManager,
  ): Promise<void> {
    await this.repoFor(entityManager).update(
      {
        referenceType: BACKGROUND_JOB_REFERENCE_TYPES.maintenanceCard,
        referenceId: cardId,
        status: In([
          BackgroundJobStatus.PENDING,
          BackgroundJobStatus.PROCESSING,
        ]),
      },
      { status: BackgroundJobStatus.CANCELLED },
    );
  }
}
