import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
} from 'typeorm';
import type { MaintenanceCardType } from '@project/types';
import { MAINTENANCE_CARD_TYPES } from '@project/types';
import { VehicleEntity } from './vehicle.entity';
import { decimalTransformer } from '../transformers/decimal.transformer';
import { dateTransformer } from '../transformers/date.transformer';
import { UuidV7BaseEntity } from './base.entity';

@Entity('maintenance_cards')
export class MaintenanceCardEntity extends UuidV7BaseEntity {
  @Index()
  @Column({ type: 'uuid', name: 'vehicle_id' })
  vehicleId: string;

  @ManyToOne(() => VehicleEntity)
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: VehicleEntity;

  @Column({ type: 'enum', enum: Object.values(MAINTENANCE_CARD_TYPES) })
  type: MaintenanceCardType;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @Column({ type: 'int', nullable: true, name: 'interval_mileage' })
  intervalMileage: number | null;

  @Column({ type: 'int', nullable: true, name: 'interval_time_months' })
  intervalTimeMonths: number | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    name: 'next_due_mileage',
    transformer: decimalTransformer,
  })
  nextDueMileage: number | null;

  @Column({
    type: 'date',
    nullable: true,
    name: 'next_due_date',
    transformer: dateTransformer,
  })
  nextDueDate: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
