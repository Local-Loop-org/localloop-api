import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { AnchorType, GroupPrivacy } from '@localloop/shared-types';

// pg returns NUMERIC as a string; coerce back to number on read.
const numericTransformer = {
  to: (v: number) => v,
  from: (v: string) => parseFloat(v),
};

@Entity('groups')
export class GroupOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'anchor_type', type: 'enum', enum: AnchorType })
  anchorType!: AnchorType;

  @Column({ name: 'anchor_geohash', type: 'varchar', length: 6 })
  @Index()
  anchorGeohash!: string;

  @Column({
    name: 'anchor_lat',
    type: 'numeric',
    precision: 9,
    scale: 6,
    transformer: numericTransformer,
  })
  anchorLat!: number;

  @Column({
    name: 'anchor_lng',
    type: 'numeric',
    precision: 9,
    scale: 6,
    transformer: numericTransformer,
  })
  anchorLng!: number;

  @Column({ name: 'anchor_label', type: 'varchar', length: 100 })
  anchorLabel!: string;

  @Column({
    type: 'enum',
    enum: GroupPrivacy,
    default: GroupPrivacy.OPEN,
  })
  privacy!: GroupPrivacy;

  @Column({ name: 'owner_id', type: 'uuid' })
  @Index()
  ownerId!: string;

  @Column({ name: 'member_count', type: 'int', default: 0 })
  memberCount!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
