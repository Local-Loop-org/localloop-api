import { MediaType } from '@localloop/shared-types';
import { PaginatedResult } from '@/shared/pagination/types';
import { DirectMessage } from '../entities/direct-message.entity';

export interface CreateDirectMessageData {
  senderId: string;
  recipientId: string;
  content: string | null;
  mediaUrl: string | null;
  mediaType: MediaType | null;
}

export interface CreateDmRequestData {
  senderId: string;
  recipientId: string;
  content: string | null;
}

export interface DirectMessageRow {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  recipientId: string;
  content: string | null;
  mediaUrl: string | null;
  mediaType: MediaType | null;
  createdAt: Date;
}

export interface DmConversationRow {
  peerId: string;
  peerName: string;
  peerAvatarUrl: string | null;
  lastMessageContent: string | null;
  lastMessageSenderName: string;
  lastMessageAt: Date;
  unreadCount: number;
  archived: boolean;
}

export interface DmInboxCursor {
  lastMessageAt: Date;
  peerId: string;
}

export interface DmRequestRow {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  content: string | null;
  createdAt: Date;
}

export interface DmRequestCursor {
  createdAt: Date;
  requestId: string;
}

export interface IDirectMessageRepository {
  create(data: CreateDirectMessageData): Promise<DirectMessage>;
  findByIdWithSender(id: string): Promise<DirectMessageRow | null>;
  listConversation(
    userAId: string,
    userBId: string,
    limit: number,
    before?: string,
  ): Promise<PaginatedResult<DirectMessageRow>>;
  hasPermissionException(userId: string, peerId: string): Promise<boolean>;
  createRequest(data: CreateDmRequestData): Promise<{ id: string }>;
  listInbox(
    userId: string,
    limit: number,
    cursor?: DmInboxCursor,
  ): Promise<PaginatedResult<DmConversationRow, DmInboxCursor>>;
  listRequests(
    userId: string,
    limit: number,
    cursor?: DmRequestCursor,
  ): Promise<PaginatedResult<DmRequestRow, DmRequestCursor>>;
}

export const DIRECT_MESSAGE_REPOSITORY = Symbol('DIRECT_MESSAGE_REPOSITORY');
