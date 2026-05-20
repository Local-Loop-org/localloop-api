import { MediaType } from '@localloop/shared-types';
import { PaginatedResult } from '@/shared/pagination/types';
import { Message } from '../entities/message.entity';

export interface CreateMessageData {
  groupId: string;
  senderId: string;
  content: string | null;
  mediaUrl: string | null;
  mediaType: MediaType | null;
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
  findByIdWithSender(id: string): Promise<MessageRow | null>;
  listByGroup(
    groupId: string,
    limit: number,
    before?: string,
  ): Promise<PaginatedResult<MessageRow>>;
}

export const MESSAGE_REPOSITORY = Symbol('MESSAGE_REPOSITORY');
