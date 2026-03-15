import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MaintenanceCardEntity } from './maintenance-card.entity';
import { decimalTransformer } from '../transformers/decimal.transformer';

@Entity('maintenance_histories')
export class MaintenanceHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
