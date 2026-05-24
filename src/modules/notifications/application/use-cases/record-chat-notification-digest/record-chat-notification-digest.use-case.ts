import { Inject, Injectable } from '@nestjs/common';
import type {
  ChatPushNotificationData,
  PushConversationKey,
} from '@localloop/shared-types';
import {
  CHAT_NOTIFICATION_DIGEST_REPOSITORY,
  ChatNotificationDigestState,
  IChatNotificationDigestRepository,
} from '../../../domain/repositories/i-chat-notification-digest.repository';
import { PushNotificationPayload } from '../../../domain/repositories/i-push-notification-provider';

export const CHAT_NOTIFICATION_DIGEST_TTL_MS = 30 * 60 * 1000;
const MAX_SNIPPETS = 4;
const MAX_PREVIEW_LENGTH = 120;
const TRUNCATED_PREVIEW_LENGTH = MAX_PREVIEW_LENGTH - 3;

export interface RecordChatNotificationDigestInput {
  recipientUserId: string;
  conversationKey: PushConversationKey;
  type: ChatPushNotificationData['type'];
  title: string;
  data: ChatPushNotificationData;
  messageId: string;
  senderId: string | null;
  senderName: string | null;
  content: string | null;
  now?: Date;
}

export interface RecordChatNotificationDigestResult extends PushNotificationPayload {
  isReplacement: boolean;
  totalCount: number;
}

@Injectable()
export class RecordChatNotificationDigestUseCase {
  constructor(
    @Inject(CHAT_NOTIFICATION_DIGEST_REPOSITORY)
    private readonly digestRepo: IChatNotificationDigestRepository,
  ) {}

  async execute(
    input: RecordChatNotificationDigestInput,
  ): Promise<RecordChatNotificationDigestResult> {
    const now = input.now ?? new Date();
    const state = await this.digestRepo.recordMessage({
      recipientUserId: input.recipientUserId,
      conversationKey: input.conversationKey,
      type: input.type,
      title: input.title,
      routeData: input.data,
      messageId: input.messageId,
      senderId: input.senderId,
      senderName: input.senderName,
      snippet: {
        messageId: input.messageId,
        senderName: input.senderName,
        preview: this.preview(input.content),
        createdAt: now.toISOString(),
      },
      now,
      staleAfterMs: CHAT_NOTIFICATION_DIGEST_TTL_MS,
      maxSnippets: MAX_SNIPPETS,
    });
    const replacementId = `chat:${input.recipientUserId}:${input.conversationKey}`;

    return {
      title: state.title,
      body: this.body(state),
      data: state.routeData,
      collapseId: replacementId,
      tag: replacementId,
      sound: state.isReplacement ? null : 'default',
      isReplacement: state.isReplacement,
      totalCount: state.totalCount,
    };
  }

  private body(state: ChatNotificationDigestState): string {
    const lines = state.snippets.map((snippet) => {
      if (state.type === 'group_message') {
        const senderName = snippet.senderName?.trim() || 'Alguém';
        return `${senderName}: ${snippet.preview}`;
      }
      return snippet.preview;
    });
    const hiddenCount = Math.max(0, state.totalCount - state.snippets.length);
    if (hiddenCount > 0) {
      lines.push(`+${hiddenCount} mensagens`);
    }
    return lines.join('\n');
  }

  private preview(content: string | null): string {
    const normalized = (content ?? 'Nova mensagem').replace(/\s+/g, ' ').trim();
    if (!normalized) return 'Nova mensagem';
    if (normalized.length <= MAX_PREVIEW_LENGTH) return normalized;
    return `${normalized.slice(0, TRUNCATED_PREVIEW_LENGTH).trimEnd()}...`;
  }
}
