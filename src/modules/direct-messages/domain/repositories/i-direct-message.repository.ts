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

export interface IDirectMessageRepository {
  create(data: CreateDirectMessageData): Promise<DirectMessage>;
  findByIdWithSender(id: string): Promise<DirectMessageRow | null>;
  listConversation(
    userAId: string,
    userBId: string,
    limit: number,
    before?: string,
  ): Promise<PaginatedResult<DirectMessageRow>>;
}

export const DIRECT_MESSAGE_REPOSITORY = Symbol('DIRECT_MESSAGE_REPOSITORY');
