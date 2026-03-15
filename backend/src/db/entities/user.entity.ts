import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  email: string;

  @Column({ type: 'varchar', unique: true, name: 'firebase_uid' })
  firebaseUid: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
