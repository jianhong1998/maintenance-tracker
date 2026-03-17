import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  ManyToOne,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MILEAGE_UNITS } from '@project/types';
import type { MileageUnit } from '@project/types';
import { UserEntity } from './user.entity';
import { decimalTransformer } from '../transformers/decimal.transformer';
import { UuidV7BaseEntity } from './base.entity';

@Entity('vehicles')
export class VehicleEntity extends UuidV7BaseEntity {
  @Index()
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'varchar' })
  brand: string;

  @Column({ type: 'varchar' })
  model: string;

  @Column({ type: 'varchar' })
  colour: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  mileage: number;

  @Column({
    type: 'enum',
    enum: Object.values(MILEAGE_UNITS),
    name: 'mileage_unit',
    default: MILEAGE_UNITS.KM,
  })
  mileageUnit: MileageUnit;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
