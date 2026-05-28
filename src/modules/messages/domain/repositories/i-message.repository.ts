import { MediaType } from '@localloop/shared-types';
import { PaginatedResult } from '@/shared/pagination/types';
import { Message } from '../entities/message.entity';

export interface CreateMessageData {
  groupId: string;
  senderId: string;
  content: string | null;
  mediaUrl: string | null;
  mediaType: MediaType | null;
  replyToMessageId?: string | null;
}

export interface MessageRow {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  content: string | null;
  mediaUrl: string | null;
  mediaType: MediaType | null;
  createdAt: Date;
}

export interface IMessageRepository {
  create(data: CreateMessageData): Promise<Message>;
  findById(id: string): Promise<Message | null>;
  findByIdWithSender(id: string): Promise<MessageRow | null>;
  listByGroup(
    groupId: string,
    limit: number,
    before?: string,
  ): Promise<PaginatedResult<MessageRow>>;
  markAsDeleted(id: string): Promise<void>;
}

export const MESSAGE_REPOSITORY = Symbol('MESSAGE_REPOSITORY');
