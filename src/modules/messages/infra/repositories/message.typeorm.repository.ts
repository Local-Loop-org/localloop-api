import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MediaType } from '@localloop/shared-types';

import { Message } from '../../domain/entities/message.entity';
import {
  CreateMessageData,
  IMessageRepository,
  MessageRow,
  PaginatedMessages,
} from '../../domain/repositories/i-message.repository';
import { UserEntity } from '@/modules/auth/infra/repositories/user.entity';
import { MessageMapper } from '../mappers/message.mapper';
import { MessageOrmEntity } from './message.entity';

interface MessageJoinRow {
  m_id: string;
  m_group_id: string;
  m_sender_id: string;
  m_content: string | null;
  m_media_url: string | null;
  m_media_type: MediaType | null;
  m_created_at: Date;
  u_display_name: string;
  u_avatar_url: string | null;
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
    });
    const saved = await this.messagesRepo.save(entity);
    return MessageMapper.toDomain(saved);
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
  ): Promise<PaginatedMessages> {
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
      .select([
        'm.id AS m_id',
        'm.group_id AS m_group_id',
        'm.sender_id AS m_sender_id',
        'm.content AS m_content',
        'm.media_url AS m_media_url',
        'm.media_type AS m_media_type',
        'm.created_at AS m_created_at',
        'u.display_name AS u_display_name',
        'u.avatar_url AS u_avatar_url',
      ]);
  }

  private rowToMessage(row: MessageJoinRow): MessageRow {
    return {
      id: row.m_id,
      groupId: row.m_group_id,
      senderId: row.m_sender_id,
      senderName: row.u_display_name,
      senderAvatar: row.u_avatar_url,
      content: row.m_content,
      mediaUrl: row.m_media_url,
      mediaType: row.m_media_type,
      createdAt: row.m_created_at,
    };
  }
}
