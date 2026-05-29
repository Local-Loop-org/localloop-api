import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MediaType } from '@localloop/shared-types';
import { PaginatedResult } from '@/shared/pagination/types';

import { Message } from '@/modules/messages/domain/entities/message.entity';
import {
  CreateMessageData,
  IMessageRepository,
  MessageRow,
} from '@/modules/messages/domain/repositories/i-message.repository';
import { UserEntity } from '@/modules/auth/infra/repositories/user.entity';
import { MessageMapper } from '../mappers/message.mapper';
import { MessageOrmEntity } from './message.entity';

const REPLY_SNIPPET_MAX_LENGTH = 120;
const REPLY_SNIPPET_TRUNCATED_LENGTH = REPLY_SNIPPET_MAX_LENGTH - 3;

function truncateReplySnippet(content: string | null): string | null {
  if (content === null) return null;
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  if (normalized.length <= REPLY_SNIPPET_MAX_LENGTH) return normalized;
  return `${normalized.slice(0, REPLY_SNIPPET_TRUNCATED_LENGTH).trimEnd()}...`;
}

interface MessageJoinRow {
  m_id: string;
  m_group_id: string;
  m_sender_id: string;
  m_content: string | null;
  m_media_url: string | null;
  m_media_type: MediaType | null;
  m_is_deleted: boolean;
  m_edited_at: Date | null;
  m_reply_to_message_id: string | null;
  m_created_at: Date;
  u_display_name: string;
  u_avatar_url: string | null;
  reply_sender_id: string | null;
  reply_content: string | null;
  reply_is_deleted: boolean | null;
}

@Injectable()
export class MessageTypeORMRepository implements IMessageRepository {
  constructor(
    @InjectRepository(MessageOrmEntity)
    private readonly messagesRepo: Repository<MessageOrmEntity>,
  ) {}

  async create(data: CreateMessageData): Promise<Message> {
    const entity = this.messagesRepo.create({
      groupId: data.groupId,
      senderId: data.senderId,
      content: data.content,
      mediaUrl: data.mediaUrl,
      mediaType: data.mediaType,
      isDeleted: false,
      replyToMessageId: data.replyToMessageId ?? null,
    });
    const saved = await this.messagesRepo.save(entity);
    return MessageMapper.toDomain(saved);
  }

  async findById(id: string): Promise<Message | null> {
    const entity = await this.messagesRepo.findOne({ where: { id } });
    return entity ? MessageMapper.toDomain(entity) : null;
  }

  async markAsDeleted(id: string): Promise<void> {
    await this.messagesRepo.update(
      { id, isDeleted: false },
      { isDeleted: true },
    );
  }

  async findByIdWithSender(id: string): Promise<MessageRow | null> {
    const row = await this.baseQuery()
      .where('m.id = :id', { id })
      .getRawOne<MessageJoinRow>();
    return row ? this.rowToMessage(row) : null;
  }

  async listByGroup(
    groupId: string,
    limit: number,
    before?: string,
  ): Promise<PaginatedResult<MessageRow>> {
    const qb = this.baseQuery()
      .where('m.group_id = :groupId', { groupId })
      .andWhere('m.is_deleted = false');

    if (before) {
      qb.andWhere('m.created_at < :before', { before });
    }

    qb.orderBy('m.created_at', 'DESC')
      .addOrderBy('m.id', 'DESC')
      .limit(limit + 1);

    const raw = await qb.getRawMany<MessageJoinRow>();
    const hasMore = raw.length > limit;
    const page = hasMore ? raw.slice(0, limit) : raw;
    const last = page.length > 0 ? page[page.length - 1] : null;
    const nextCursor = hasMore && last ? last.m_created_at.toISOString() : null;

    return {
      rows: page.map((row) => this.rowToMessage(row)),
      nextCursor,
    };
  }

  private baseQuery() {
    return this.messagesRepo
      .createQueryBuilder('m')
      .innerJoin(UserEntity, 'u', 'u.id = m.sender_id')
      .leftJoin(MessageOrmEntity, 'reply', 'reply.id = m.reply_to_message_id')
      .select([
        'm.id AS m_id',
        'm.group_id AS m_group_id',
        'm.sender_id AS m_sender_id',
        'm.content AS m_content',
        'm.media_url AS m_media_url',
        'm.media_type AS m_media_type',
        'm.is_deleted AS m_is_deleted',
        'm.edited_at AS m_edited_at',
        'm.reply_to_message_id AS m_reply_to_message_id',
        'm.created_at AS m_created_at',
        'u.display_name AS u_display_name',
        'u.avatar_url AS u_avatar_url',
        'reply.sender_id AS reply_sender_id',
        'reply.content AS reply_content',
        'reply.is_deleted AS reply_is_deleted',
      ]);
  }

  private rowToMessage(row: MessageJoinRow): MessageRow {
    const replyTo: MessageRow['replyTo'] =
      row.m_reply_to_message_id && row.reply_sender_id
        ? {
            id: row.m_reply_to_message_id,
            authorId: row.reply_sender_id,
            snippet: row.reply_is_deleted
              ? null
              : truncateReplySnippet(row.reply_content),
            isDeleted: row.reply_is_deleted ?? false,
          }
        : null;

    return {
      id: row.m_id,
      groupId: row.m_group_id,
      senderId: row.m_sender_id,
      senderName: row.u_display_name,
      senderAvatarUrl: row.u_avatar_url,
      content: row.m_content,
      mediaUrl: row.m_media_url,
      mediaType: row.m_media_type,
      isDeleted: row.m_is_deleted,
      editedAt: row.m_edited_at,
      replyTo,
      createdAt: row.m_created_at,
    };
  }
}
