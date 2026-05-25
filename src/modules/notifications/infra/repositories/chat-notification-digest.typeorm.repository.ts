import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import type { PushConversationKey } from '@localloop/shared-types';
import {
  ChatNotificationDigestSnippet,
  ChatNotificationDigestState,
  IChatNotificationDigestRepository,
  RecordChatNotificationDigestInput,
} from '@/modules/notifications/domain/repositories/i-chat-notification-digest.repository';
import { ChatNotificationDigestOrmEntity } from '@/modules/notifications/infra/repositories/chat-notification-digest.entity';

@Injectable()
export class ChatNotificationDigestTypeORMRepository implements IChatNotificationDigestRepository {
  constructor(private readonly dataSource: DataSource) {}

  async recordMessage(
    input: RecordChatNotificationDigestInput,
  ): Promise<ChatNotificationDigestState> {
    return this.dataSource.transaction(async (manager) => {
      const inserted = await this.insertInitialDigest(manager, input);
      const digest = await manager.findOne(ChatNotificationDigestOrmEntity, {
        where: {
          recipientUserId: input.recipientUserId,
          conversationKey: input.conversationKey,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!digest) {
        throw new Error('Failed to record chat notification digest');
      }

      if (inserted) {
        return this.toState(digest, false);
      }

      const stale =
        input.now.getTime() - digest.lastMessageAt.getTime() >
        input.staleAfterMs;
      if (stale) {
        this.resetDigest(digest, input);
        await manager.save(ChatNotificationDigestOrmEntity, digest);
        return this.toState(digest, false);
      }

      this.appendToDigest(digest, input);
      await manager.save(ChatNotificationDigestOrmEntity, digest);
      return this.toState(digest, true);
    });
  }

  async clear(
    recipientUserId: string,
    conversationKey: PushConversationKey,
  ): Promise<void> {
    await this.dataSource
      .getRepository(ChatNotificationDigestOrmEntity)
      .delete({
        recipientUserId,
        conversationKey,
      });
  }

  private async insertInitialDigest(
    manager: EntityManager,
    input: RecordChatNotificationDigestInput,
  ): Promise<boolean> {
    const rows = (await manager.query(
      `
        INSERT INTO chat_notification_digests (
          recipient_user_id,
          conversation_key,
          type,
          title,
          route_data,
          latest_message_id,
          latest_sender_id,
          latest_sender_name,
          total_count,
          snippets,
          last_message_at,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, 1, $9::jsonb, $10, now(), now())
        ON CONFLICT (recipient_user_id, conversation_key) DO NOTHING
        RETURNING id
      `,
      [
        input.recipientUserId,
        input.conversationKey,
        input.type,
        input.title,
        JSON.stringify(input.routeData),
        input.messageId,
        input.senderId,
        input.senderName,
        JSON.stringify([input.snippet]),
        input.now,
      ],
    )) as Array<{ id: string }>;

    return rows.length > 0;
  }

  private resetDigest(
    digest: ChatNotificationDigestOrmEntity,
    input: RecordChatNotificationDigestInput,
  ): void {
    digest.type = input.type;
    digest.title = input.title;
    digest.routeData = input.routeData;
    digest.latestMessageId = input.messageId;
    digest.latestSenderId = input.senderId;
    digest.latestSenderName = input.senderName;
    digest.totalCount = 1;
    digest.snippets = [input.snippet];
    digest.lastMessageAt = input.now;
  }

  private appendToDigest(
    digest: ChatNotificationDigestOrmEntity,
    input: RecordChatNotificationDigestInput,
  ): void {
    digest.type = input.type;
    digest.title = input.title;
    digest.routeData = input.routeData;
    digest.latestMessageId = input.messageId;
    digest.latestSenderId = input.senderId;
    digest.latestSenderName = input.senderName;
    digest.totalCount += 1;
    digest.snippets = [
      ...this.validSnippets(digest.snippets),
      input.snippet,
    ].slice(-input.maxSnippets);
    digest.lastMessageAt = input.now;
  }

  private validSnippets(snippets: unknown): ChatNotificationDigestSnippet[] {
    if (!Array.isArray(snippets)) return [];
    return snippets.filter(
      (snippet): snippet is ChatNotificationDigestSnippet => {
        if (!snippet || typeof snippet !== 'object') return false;
        const record = snippet as Record<string, unknown>;
        return (
          typeof record.messageId === 'string' &&
          (typeof record.senderName === 'string' ||
            record.senderName === null) &&
          typeof record.preview === 'string' &&
          typeof record.createdAt === 'string'
        );
      },
    );
  }

  private toState(
    digest: ChatNotificationDigestOrmEntity,
    isReplacement: boolean,
  ): ChatNotificationDigestState {
    return {
      recipientUserId: digest.recipientUserId,
      conversationKey: digest.conversationKey as PushConversationKey,
      type: digest.type,
      title: digest.title,
      routeData: digest.routeData,
      totalCount: digest.totalCount,
      snippets: this.validSnippets(digest.snippets),
      lastMessageAt: digest.lastMessageAt,
      isReplacement,
    };
  }
}
