import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Provider, DmPermission } from '@localloop/shared-types';

@Entity('users')
@Index(['providerId', 'provider'], { unique: true })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', name: 'provider_id', length: 255 })
  providerId!: string;

  @Column({ type: 'enum', enum: Provider })
  provider!: Provider;

  @Column({ type: 'varchar', name: 'display_name', length: 80 })
  displayName!: string;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl!: string | null;

  @Column({ type: 'varchar', length: 6, nullable: true })
  @Index()
  geohash!: string | null;

  @Column({
    name: 'dm_permission',
    type: 'enum',
    enum: DmPermission,
    default: DmPermission.MEMBERS,
  })
  dmPermission!: DmPermission;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({
    name: 'last_seen_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  lastSeenAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
