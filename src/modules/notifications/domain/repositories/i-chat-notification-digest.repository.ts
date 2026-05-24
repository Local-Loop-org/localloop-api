import type {
  ChatPushNotificationData,
  PushConversationKey,
} from '@localloop/shared-types';

export type ChatNotificationDigestType = ChatPushNotificationData['type'];

export interface ChatNotificationDigestSnippet {
  messageId: string;
  senderName: string | null;
  preview: string;
  createdAt: string;
}

export interface RecordChatNotificationDigestInput {
  recipientUserId: string;
  conversationKey: PushConversationKey;
  type: ChatNotificationDigestType;
  title: string;
  routeData: ChatPushNotificationData;
  messageId: string;
  senderId: string | null;
  senderName: string | null;
  snippet: ChatNotificationDigestSnippet;
  now: Date;
  staleAfterMs: number;
  maxSnippets: number;
}

export interface ChatNotificationDigestState {
  recipientUserId: string;
  conversationKey: PushConversationKey;
  type: ChatNotificationDigestType;
  title: string;
  routeData: ChatPushNotificationData;
  totalCount: number;
  snippets: ChatNotificationDigestSnippet[];
  lastMessageAt: Date;
  isReplacement: boolean;
}

export interface IChatNotificationDigestRepository {
  recordMessage(
    input: RecordChatNotificationDigestInput,
  ): Promise<ChatNotificationDigestState>;
  clear(
    recipientUserId: string,
    conversationKey: PushConversationKey,
  ): Promise<void>;
}

export const CHAT_NOTIFICATION_DIGEST_REPOSITORY = Symbol(
  'CHAT_NOTIFICATION_DIGEST_REPOSITORY',
);
