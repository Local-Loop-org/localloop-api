import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MediaType } from '@localloop/shared-types';

import { DirectMessage } from '@/modules/direct-messages/domain/entities/direct-message.entity';
import {
  CreateDirectMessageData,
  DirectMessageRow,
  IDirectMessageRepository,
  PaginatedDirectMessages,
} from '@/modules/direct-messages/domain/repositories/i-direct-message.repository';
import { UserEntity } from '@/modules/auth/infra/repositories/user.entity';
import { DirectMessageMapper } from '../mappers/direct-message.mapper';
import { DirectMessageOrmEntity } from './direct-message.entity';

interface DirectMessageJoinRow {
  m_id: string;
  m_sender_id: string;
  m_recipient_id: string;
  m_content: string | null;
  m_media_url: string | null;
  m_media_type: MediaType | null;
  m_created_at: Date;
  u_display_name: string;
  u_avatar_url: string | null;
}

@Injectable()
export class DirectMessageTypeORMRepository implements IDirectMessageRepository {
  constructor(
    @InjectRepository(DirectMessageOrmEntity)
    private readonly directMessagesRepo: Repository<DirectMessageOrmEntity>,
  ) {}

  async create(data: CreateDirectMessageData): Promise<DirectMessage> {
    const entity = this.directMessagesRepo.create({
      senderId: data.senderId,
      recipientId: data.recipientId,
      content: data.content,
      mediaUrl: data.mediaUrl,
      mediaType: data.mediaType,
      isDeleted: false,
    });
    const saved = await this.directMessagesRepo.save(entity);
    return DirectMessageMapper.toDomain(saved);
  }

  async findByIdWithSender(id: string): Promise<DirectMessageRow | null> {
    const row = await this.baseQuery()
      .where('m.id = :id', { id })
      .getRawOne<DirectMessageJoinRow>();
    return row ? this.rowToDm(row) : null;
  }

  async listConversation(
    userAId: string,
    userBId: string,
    limit: number,
    before?: string,
  ): Promise<PaginatedDirectMessages> {
    const qb = this.baseQuery()
      .where(
        '((m.sender_id = :a AND m.recipient_id = :b) OR (m.sender_id = :b AND m.recipient_id = :a))',
        { a: userAId, b: userBId },
      )
      .andWhere('m.is_deleted = false');

    if (before) {
      qb.andWhere('m.created_at < :before', { before });
    }

    qb.orderBy('m.created_at', 'DESC')
      .addOrderBy('m.id', 'DESC')
      .limit(limit + 1);

    const raw = await qb.getRawMany<DirectMessageJoinRow>();
    const hasMore = raw.length > limit;
    const page = hasMore ? raw.slice(0, limit) : raw;
    const last = page.length > 0 ? page[page.length - 1] : null;
    const nextCursor = hasMore && last ? last.m_created_at.toISOString() : null;

    return {
      rows: page.map((row) => this.rowToDm(row)),
      nextCursor,
    };
  }

  private baseQuery() {
    return this.directMessagesRepo
      .createQueryBuilder('m')
      .innerJoin(UserEntity, 'u', 'u.id = m.sender_id')
      .select([
        'm.id AS m_id',
        'm.sender_id AS m_sender_id',
        'm.recipient_id AS m_recipient_id',
        'm.content AS m_content',
        'm.media_url AS m_media_url',
        'm.media_type AS m_media_type',
        'm.created_at AS m_created_at',
        'u.display_name AS u_display_name',
        'u.avatar_url AS u_avatar_url',
      ]);
  }

  private rowToDm(row: DirectMessageJoinRow): DirectMessageRow {
    return {
      id: row.m_id,
      senderId: row.m_sender_id,
      senderName: row.u_display_name,
      senderAvatar: row.u_avatar_url,
      recipientId: row.m_recipient_id,
      content: row.m_content,
      mediaUrl: row.m_media_url,
      mediaType: row.m_media_type,
      createdAt: row.m_created_at,
    };
  }
}
