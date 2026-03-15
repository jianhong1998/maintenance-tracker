import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { VehicleEntity } from './vehicle.entity';
import { decimalTransformer } from '../transformers/decimal.transformer';

export enum MaintenanceCardType {
  TASK = 'task',
  PART = 'part',
  ITEM = 'item',
}

@Entity('maintenance_cards')
export class MaintenanceCardEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'vehicle_id' })
  vehicleId: string;

  @ManyToOne(() => VehicleEntity)
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: VehicleEntity;

  @Column({ type: 'enum', enum: MaintenanceCardType })
  type: MaintenanceCardType;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    name: 'interval_mileage',
    transformer: decimalTransformer,
  })
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

  @Column({ type: 'date', nullable: true, name: 'next_due_date' })
  nextDueDate: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date | null;
}
