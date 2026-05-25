import { Inject, Injectable } from '@nestjs/common';
import type { PushConversationKey } from '@localloop/shared-types';
import {
  CHAT_NOTIFICATION_DIGEST_REPOSITORY,
  IChatNotificationDigestRepository,
} from '@/modules/notifications/domain/repositories/i-chat-notification-digest.repository';

export interface ClearChatNotificationDigestInput {
  recipientUserId: string;
  conversationKey: PushConversationKey;
}

@Injectable()
export class ClearChatNotificationDigestUseCase {
  constructor(
    @Inject(CHAT_NOTIFICATION_DIGEST_REPOSITORY)
    private readonly digestRepo: IChatNotificationDigestRepository,
  ) {}

  async execute(input: ClearChatNotificationDigestInput): Promise<void> {
    await this.digestRepo.clear(input.recipientUserId, input.conversationKey);
  }
}
