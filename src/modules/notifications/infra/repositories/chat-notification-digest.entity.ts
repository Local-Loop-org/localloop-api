import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import type { ChatPushNotificationData } from '@localloop/shared-types';
import type {
  ChatNotificationDigestSnippet,
  ChatNotificationDigestType,
} from '@/modules/notifications/domain/repositories/i-chat-notification-digest.repository';

@Entity('chat_notification_digests')
@Unique('uq_chat_notification_digests_recipient_conversation', [
  'recipientUserId',
  'conversationKey',
])
@Index('idx_chat_notification_digests_recipient_user_id', ['recipientUserId'])
export class ChatNotificationDigestOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'recipient_user_id', type: 'uuid' })
  recipientUserId!: string;

  @Column({ name: 'conversation_key', type: 'varchar', length: 256 })
  conversationKey!: string;

  @Column({ type: 'varchar', length: 32 })
  type!: ChatNotificationDigestType;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({ name: 'route_data', type: 'jsonb' })
  routeData!: ChatPushNotificationData;

  @Column({ name: 'latest_message_id', type: 'uuid' })
  latestMessageId!: string;

  @Column({ name: 'latest_sender_id', type: 'uuid', nullable: true })
  latestSenderId!: string | null;

  @Column({
    name: 'latest_sender_name',
    type: 'varchar',
    length: 160,
    nullable: true,
  })
  latestSenderName!: string | null;

  @Column({ name: 'total_count', type: 'integer', default: 1 })
  totalCount!: number;

  @Column({ type: 'jsonb' })
  snippets!: ChatNotificationDigestSnippet[];

  @Column({ name: 'last_message_at', type: 'timestamptz' })
  lastMessageAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
