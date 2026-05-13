import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { DevicePlatform, PushProvider } from '@localloop/shared-types';

@Entity('push_devices')
@Unique('uq_push_devices_user_installation_provider', [
  'userId',
  'installationId',
  'provider',
])
@Index('idx_push_devices_user_id', ['userId'])
export class PushDeviceOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'installation_id', type: 'varchar', length: 128 })
  installationId!: string;

  @Column({ type: 'enum', enum: PushProvider })
  provider!: PushProvider;

  @Column({ type: 'enum', enum: DevicePlatform })
  platform!: DevicePlatform;

  @Column({ type: 'text' })
  token!: string;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @Column({
    name: 'last_seen_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  lastSeenAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'disabled_at', type: 'timestamptz', nullable: true })
  disabledAt!: Date | null;
}
