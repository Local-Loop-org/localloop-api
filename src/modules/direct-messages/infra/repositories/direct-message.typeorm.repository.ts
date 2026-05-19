import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { MediaType } from '@localloop/shared-types';
import { PaginatedResult } from '@/shared/pagination/types';

import { DirectMessage } from '@/modules/direct-messages/domain/entities/direct-message.entity';
import {
  CreateDirectMessageData,
  CreateDmRequestData,
  DirectMessageRow,
  DmConversationRow,
  DmExceptionCursor,
  DmExceptionRow,
  DmInboxCursor,
  DmRequestCursor,
  DmRequestRecord,
  DmRequestRow,
  IDirectMessageRepository,
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

interface InboxRawRow {
  peer_id: string;
  last_content: string | null;
  last_msg_at: Date;
  peer_name: string;
  peer_avatar_url: string | null;
  last_sender_name: string;
  archived: boolean;
  unread_count: number;
}

interface RequestRawRow {
  r_id: string;
  r_sender_id: string;
  r_content: string | null;
  r_created_at: Date;
  u_display_name: string;
  u_avatar_url: string | null;
}

interface ExceptionRawRow {
  peer_id: string;
  peer_name: string;
  peer_avatar_url: string | null;
  created_at: Date;
}

interface RequestRecordRawRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string | null;
  created_at: Date;
}

@Injectable()
export class DirectMessageTypeORMRepository implements IDirectMessageRepository {
  constructor(
    @InjectRepository(DirectMessageOrmEntity)
    private readonly directMessagesRepo: Repository<DirectMessageOrmEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async createDirectDeliveryAtomic(
    data: CreateDirectMessageData,
  ): Promise<DirectMessage> {
    return this.dataSource.transaction(async (manager) => {
      const messagesRepo = manager.getRepository(DirectMessageOrmEntity);
      const entity = messagesRepo.create({
        senderId: data.senderId,
        recipientId: data.recipientId,
        content: data.content,
        mediaUrl: data.mediaUrl,
        mediaType: data.mediaType,
        isDeleted: false,
      });
      const saved = await messagesRepo.save(entity);

      await manager.query(
        `INSERT INTO dm_permission_exceptions (user_id, allowed_peer_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [data.senderId, data.recipientId],
      );

      await manager.query(
        `INSERT INTO dm_conversation_state (user_id, peer_id, last_read_at)
         VALUES ($1, $2, now())
         ON CONFLICT DO NOTHING`,
        [data.senderId, data.recipientId],
      );

      return DirectMessageMapper.toDomain(saved);
    });
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
  ): Promise<PaginatedResult<DirectMessageRow>> {
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

  async hasPermissionException(
    userId: string,
    peerId: string,
  ): Promise<boolean> {
    const rows = await this.dataSource.query<{ exists: boolean }[]>(
      `SELECT EXISTS(
        SELECT 1 FROM dm_permission_exceptions
        WHERE user_id = $1 AND allowed_peer_id = $2
      ) AS exists`,
      [userId, peerId],
    );
    return rows[0].exists;
  }

  async createRequest(data: CreateDmRequestData): Promise<{ id: string }> {
    const rows = await this.dataSource.query<{ id: string }[]>(
      `INSERT INTO dm_requests (sender_id, recipient_id, content)
       VALUES ($1, $2, $3)
       ON CONFLICT (sender_id, recipient_id) DO UPDATE SET content = EXCLUDED.content
       RETURNING id`,
      [data.senderId, data.recipientId, data.content],
    );
    return { id: rows[0].id };
  }

  async findRequestById(requestId: string): Promise<DmRequestRecord | null> {
    const rows = await this.dataSource.query<RequestRecordRawRow[]>(
      `SELECT id, sender_id, recipient_id, content, created_at
       FROM dm_requests
       WHERE id = $1`,
      [requestId],
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      senderId: r.sender_id,
      recipientId: r.recipient_id,
      content: r.content,
      createdAt: r.created_at,
    };
  }

  async acceptRequestAtomic(requestId: string): Promise<DirectMessageRow> {
    return this.dataSource.transaction(async (manager) => {
      const locked = await manager.query<RequestRecordRawRow[]>(
        `SELECT id, sender_id, recipient_id, content, created_at
         FROM dm_requests
         WHERE id = $1
         FOR UPDATE`,
        [requestId],
      );
      if (locked.length === 0) {
        throw new NotFoundException({
          error: 'DM_REQUEST_NOT_FOUND',
          message: 'DM request not found',
        });
      }
      const req = locked[0];

      const inserted = await manager.query<{ id: string }[]>(
        `INSERT INTO direct_messages
           (sender_id, recipient_id, content, media_url, media_type, is_deleted, created_at)
         VALUES ($1, $2, $3, NULL, NULL, false, $4)
         RETURNING id`,
        [req.sender_id, req.recipient_id, req.content, req.created_at],
      );
      const newId = inserted[0].id;

      await manager.query(
        `INSERT INTO dm_permission_exceptions (user_id, allowed_peer_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [req.recipient_id, req.sender_id],
      );

      await manager.query(
        `INSERT INTO dm_conversation_state (user_id, peer_id, last_read_at)
         VALUES ($1, $2, now())
         ON CONFLICT DO NOTHING`,
        [req.sender_id, req.recipient_id],
      );

      await manager.query(`DELETE FROM dm_requests WHERE id = $1`, [requestId]);

      const joined = await manager.query<DirectMessageJoinRow[]>(
        `SELECT
           m.id           AS m_id,
           m.sender_id    AS m_sender_id,
           m.recipient_id AS m_recipient_id,
           m.content      AS m_content,
           m.media_url    AS m_media_url,
           m.media_type   AS m_media_type,
           m.created_at   AS m_created_at,
           u.display_name AS u_display_name,
           u.avatar_url   AS u_avatar_url
         FROM direct_messages m
         JOIN users u ON u.id = m.sender_id
         WHERE m.id = $1`,
        [newId],
      );
      return this.rowToDm(joined[0]);
    });
  }

  async declineRequest(requestId: string): Promise<void> {
    await this.dataSource.query(`DELETE FROM dm_requests WHERE id = $1`, [
      requestId,
    ]);
  }

  async listExceptions(
    userId: string,
    limit: number,
    cursor?: DmExceptionCursor,
  ): Promise<PaginatedResult<DmExceptionRow, DmExceptionCursor>> {
    const params: unknown[] = [userId, limit + 1];
    let cursorClause = '';
    if (cursor) {
      params.push(cursor.createdAt.toISOString(), cursor.peerId);
      cursorClause = `AND (e.created_at, e.allowed_peer_id) < ($3::timestamptz, $4::uuid)`;
    }

    const sql = `
      SELECT
        e.allowed_peer_id AS peer_id,
        e.created_at      AS created_at,
        u.display_name    AS peer_name,
        u.avatar_url      AS peer_avatar_url
      FROM dm_permission_exceptions e
      JOIN users u ON u.id = e.allowed_peer_id
      WHERE e.user_id = $1
        AND u.is_active = true
        ${cursorClause}
      ORDER BY e.created_at DESC, e.allowed_peer_id DESC
      LIMIT $2
    `;

    const raw = await this.dataSource.query<ExceptionRawRow[]>(sql, params);
    const hasMore = raw.length > limit;
    const page = hasMore ? raw.slice(0, limit) : raw;
    const last = page.length > 0 ? page[page.length - 1] : null;
    const nextCursor =
      hasMore && last
        ? { createdAt: last.created_at, peerId: last.peer_id }
        : null;

    return {
      rows: page.map((r) => ({
        peerId: r.peer_id,
        peerName: r.peer_name,
        peerAvatarUrl: r.peer_avatar_url,
        createdAt: r.created_at,
      })),
      nextCursor,
    };
  }

  async addException(userId: string, peerId: string): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO dm_permission_exceptions (user_id, allowed_peer_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [userId, peerId],
    );
  }

  async removeException(userId: string, peerId: string): Promise<void> {
    await this.dataSource.query(
      `DELETE FROM dm_permission_exceptions
       WHERE user_id = $1 AND allowed_peer_id = $2`,
      [userId, peerId],
    );
  }

  async listInbox(
    userId: string,
    limit: number,
    cursor?: DmInboxCursor,
  ): Promise<PaginatedResult<DmConversationRow, DmInboxCursor>> {
    const params: unknown[] = [userId, limit + 1];
    let cursorClause = '';
    if (cursor) {
      params.push(cursor.lastMessageAt.toISOString(), cursor.peerId);
      cursorClause = `AND (l.last_msg_at, l.peer_id) < ($3::timestamptz, $4::uuid)`;
    }

    const sql = `
      WITH latest AS (
        SELECT DISTINCT ON (LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id))
          CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END AS peer_id,
          sender_id AS last_sender_id,
          content AS last_content,
          created_at AS last_msg_at
        FROM direct_messages
        WHERE (sender_id = $1 OR recipient_id = $1)
          AND is_deleted = false
        ORDER BY
          LEAST(sender_id, recipient_id),
          GREATEST(sender_id, recipient_id),
          created_at DESC
      )
      SELECT
        l.peer_id,
        l.last_content,
        l.last_msg_at,
        up.display_name AS peer_name,
        up.avatar_url   AS peer_avatar_url,
        us.display_name AS last_sender_name,
        COALESCE(cs.archived, false) AS archived,
        (
          SELECT COUNT(*)::int
          FROM direct_messages m2
          WHERE ((m2.sender_id = $1 AND m2.recipient_id = l.peer_id)
              OR (m2.sender_id = l.peer_id AND m2.recipient_id = $1))
            AND m2.is_deleted = false
            AND m2.sender_id != $1
            AND m2.created_at > COALESCE(cs.last_read_at, '-infinity'::timestamptz)
        ) AS unread_count
      FROM latest l
      JOIN users up ON up.id = l.peer_id
      JOIN users us ON us.id = l.last_sender_id
      LEFT JOIN dm_conversation_state cs
        ON cs.user_id = $1 AND cs.peer_id = l.peer_id
      WHERE true ${cursorClause}
      ORDER BY l.last_msg_at DESC, l.peer_id DESC
      LIMIT $2
    `;

    const raw = await this.dataSource.query<InboxRawRow[]>(sql, params);
    const hasMore = raw.length > limit;
    const page = hasMore ? raw.slice(0, limit) : raw;
    const last = page.length > 0 ? page[page.length - 1] : null;
    const nextCursor =
      hasMore && last
        ? { lastMessageAt: last.last_msg_at, peerId: last.peer_id }
        : null;

    return {
      rows: page.map((r) => ({
        peerId: r.peer_id,
        peerName: r.peer_name,
        peerAvatarUrl: r.peer_avatar_url,
        lastMessageContent: r.last_content,
        lastMessageSenderName: r.last_sender_name,
        lastMessageAt: r.last_msg_at,
        unreadCount: Number(r.unread_count),
        archived: r.archived,
      })),
      nextCursor,
    };
  }

  async listRequests(
    userId: string,
    limit: number,
    cursor?: DmRequestCursor,
  ): Promise<PaginatedResult<DmRequestRow, DmRequestCursor>> {
    const params: unknown[] = [userId, limit + 1];
    let cursorClause = '';
    if (cursor) {
      params.push(cursor.createdAt.toISOString(), cursor.requestId);
      cursorClause = `AND (r.created_at, r.id) < ($3::timestamptz, $4::uuid)`;
    }

    const sql = `
      SELECT
        r.id           AS r_id,
        r.sender_id    AS r_sender_id,
        r.content      AS r_content,
        r.created_at   AS r_created_at,
        u.display_name AS u_display_name,
        u.avatar_url   AS u_avatar_url
      FROM dm_requests r
      JOIN users u ON u.id = r.sender_id
      WHERE r.recipient_id = $1
        ${cursorClause}
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT $2
    `;

    const raw = await this.dataSource.query<RequestRawRow[]>(sql, params);
    const hasMore = raw.length > limit;
    const page = hasMore ? raw.slice(0, limit) : raw;
    const last = page.length > 0 ? page[page.length - 1] : null;
    const nextCursor =
      hasMore && last
        ? { createdAt: last.r_created_at, requestId: last.r_id }
        : null;

    return {
      rows: page.map((r) => ({
        id: r.r_id,
        senderId: r.r_sender_id,
        senderName: r.u_display_name,
        senderAvatarUrl: r.u_avatar_url,
        content: r.r_content,
        createdAt: r.r_created_at,
      })),
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
