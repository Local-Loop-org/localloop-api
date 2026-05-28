import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MediaType } from '@localloop/shared-types';

@Entity('messages')
@Index('idx_messages_group_created', ['groupId', 'createdAt'])
export class MessageOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @Column({ name: 'sender_id', type: 'uuid' })
  senderId!: string;

  @Column({ type: 'text', nullable: true })
  content!: string | null;

  @Column({ name: 'media_url', type: 'text', nullable: true })
  mediaUrl!: string | null;

  @Column({
    name: 'media_type',
    type: 'enum',
    enum: MediaType,
    nullable: true,
  })
  mediaType!: MediaType | null;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted!: boolean;

  @Column({ name: 'reply_to_message_id', type: 'uuid', nullable: true })
  replyToMessageId!: string | null;

  @Column({ name: 'edited_at', type: 'timestamptz', nullable: true })
  editedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
