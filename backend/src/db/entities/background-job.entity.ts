import { Column, CreateDateColumn, Entity, UpdateDateColumn } from 'typeorm';
import { UuidV7BaseEntity } from './base.entity';

export enum BackgroundJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  DONE = 'done',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('background_jobs')
export class BackgroundJobEntity extends UuidV7BaseEntity {
  @Column({ type: 'varchar', name: 'job_type' })
  jobType: string;

  @Column({ type: 'uuid', nullable: true, name: 'reference_id' })
  referenceId: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'reference_type' })
  referenceType: string | null;

  @Column({ type: 'varchar', unique: true, name: 'idempotency_key' })
  idempotencyKey: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: BackgroundJobStatus,
    default: BackgroundJobStatus.PENDING,
  })
  status: BackgroundJobStatus;

  @Column({ type: 'timestamptz', name: 'scheduled_from' })
  scheduledFrom: Date;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_attempted_at' })
  lastAttemptedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
