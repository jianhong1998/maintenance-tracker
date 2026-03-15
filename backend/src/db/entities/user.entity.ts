import { Column, CreateDateColumn, Entity } from 'typeorm';
import { UuidV7BaseEntity } from './base.entity';

@Entity('users')
export class UserEntity extends UuidV7BaseEntity {
  @Column({ type: 'varchar', unique: true })
  email: string;

  @Column({ type: 'varchar', unique: true, name: 'firebase_uid' })
  firebaseUid: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
