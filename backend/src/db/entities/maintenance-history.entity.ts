import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { MaintenanceCardEntity } from './maintenance-card.entity';
import { decimalTransformer } from '../transformers/decimal.transformer';
import { UuidV7BaseEntity } from './base.entity';

@Entity('maintenance_histories')
export class MaintenanceHistoryEntity extends UuidV7BaseEntity {
  @Index()
  @Column({ type: 'uuid', name: 'maintenance_card_id' })
  maintenanceCardId: string;

  @ManyToOne(() => MaintenanceCardEntity)
  @JoinColumn({ name: 'maintenance_card_id' })
  maintenanceCard: MaintenanceCardEntity;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    name: 'done_at_mileage',
    transformer: decimalTransformer,
  })
  doneAtMileage: number | null;

  @Column({ type: 'date', name: 'done_at_date' })
  doneAtDate: Date;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
