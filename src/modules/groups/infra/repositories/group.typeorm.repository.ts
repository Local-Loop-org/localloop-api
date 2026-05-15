import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
import {
  ApproveJoinRequestAtomicParams,
  CreateGroupData,
  IGroupRepository,
  JoinRequestWithRequester,
  MyGroupLastMessage,
  MyGroupsCursor,
  MyGroupSummary,
  NearbyGroupRow,
  PaginatedMembers,
  PaginatedMyGroups,
  UpdateGroupData,
} from '@domain/repositories/i-group.repository';
import { AnchorType } from '@localloop/shared-types';
import { Group } from '@domain/entities/group.entity';
import { GroupMember } from '@domain/entities/group-member.entity';
import { GroupJoinRequest } from '@domain/entities/group-join-request.entity';
import { GroupOrmEntity } from './group.entity';
import { GroupMemberOrmEntity } from './group-member.entity';
import { GroupJoinRequestOrmEntity } from './group-join-request.entity';
import { UserEntity } from '@/modules/auth/infra/repositories/user.entity';
import { GroupMapper } from '../mappers/group.mapper';
import {
  MemberRole,
  MemberStatus,
  RequestStatus,
} from '@localloop/shared-types';

interface MyGroupSummaryColumns {
  gm_last_read_at: Date | null;
  lm_content: string | null;
  lm_created_at: Date | null;
  u_display_name: string | null;
  unread_count: number | string;
  last_activity_at: Date;
}

interface MyGroupListRawRow extends MyGroupSummaryColumns {
  g_id: string;
  g_name: string;
  g_anchor_type: AnchorType;
  g_anchor_label: string;
  g_member_count: number | string;
  gm_role: MemberRole;
  gm_joined_at: Date;
}

interface MyGroupSummaryRawRow extends MyGroupSummaryColumns {
  group_id: string;
}

const MY_GROUP_SUMMARY_SELECT_SQL = `
        gm.last_read_at AS gm_last_read_at,
        lm.content AS lm_content,
        lm.created_at AS lm_created_at,
        u.display_name AS u_display_name,
        uc.unread_count AS unread_count,
        COALESCE(lm.created_at, gm.joined_at) AS last_activity_at
`;

const MY_GROUP_SUMMARY_JOINS_SQL = `
      LEFT JOIN LATERAL (
        SELECT m.content, m.created_at, m.sender_id
        FROM messages m
        WHERE m.group_id = g.id AND m.is_deleted = false
        ORDER BY m.created_at DESC
        LIMIT 1
      ) lm ON true
      LEFT JOIN users u ON u.id = lm.sender_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS unread_count
        FROM messages m
        WHERE m.group_id = g.id
          AND m.is_deleted = false
          AND m.sender_id <> $1::uuid
          AND m.created_at > COALESCE(gm.last_read_at, gm.joined_at)
      ) uc ON true
`;

@Injectable()
export class GroupTypeORMRepository implements IGroupRepository {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(GroupOrmEntity)
    private readonly groupsRepo: Repository<GroupOrmEntity>,
    @InjectRepository(GroupMemberOrmEntity)
    private readonly membersRepo: Repository<GroupMemberOrmEntity>,
    @InjectRepository(GroupJoinRequestOrmEntity)
    private readonly requestsRepo: Repository<GroupJoinRequestOrmEntity>,
  ) {}

  async createGroupWithOwner(data: CreateGroupData): Promise<Group> {
    return this.dataSource.transaction(async (manager) => {
      const group = manager.create(GroupOrmEntity, {
        name: data.name,
        description: data.description,
        anchorType: data.anchorType,
        anchorGeohash: data.anchorGeohash,
        anchorLat: data.anchorLat,
        anchorLng: data.anchorLng,
        anchorLabel: data.anchorLabel,
        privacy: data.privacy,
        radiusKm: data.radiusKm,
        ownerId: data.ownerId,
        memberCount: data.memberCount,
        isActive: true,
      });
      const savedGroup = await manager.save(group);

      const member = manager.create(GroupMemberOrmEntity, {
        groupId: savedGroup.id,
        userId: data.ownerId,
        role: MemberRole.OWNER,
        status: MemberStatus.ACTIVE,
        lastReadAt: new Date(),
      });
      await manager.save(member);

      return GroupMapper.toDomain(savedGroup);
    });
  }

  async findById(id: string): Promise<Group | null> {
    const entity = await this.groupsRepo.findOneBy({ id });
    return entity ? GroupMapper.toDomain(entity) : null;
  }

  async updateGroup(id: string, data: UpdateGroupData): Promise<Group> {
    await this.groupsRepo.update({ id }, data);
    const entity = await this.groupsRepo.findOneBy({ id });
    return GroupMapper.toDomain(entity!);
  }

  async findNearby(
    userId: string,
    geohashPrefixes: string[],
  ): Promise<NearbyGroupRow[]> {
    if (geohashPrefixes.length === 0) return [];
    const result = await this.groupsRepo
      .createQueryBuilder('g')
      .leftJoin(
        GroupMemberOrmEntity,
        'gm',
        'gm.group_id = g.id AND gm.user_id = :userId',
        { userId },
      )
      .leftJoin(
        GroupJoinRequestOrmEntity,
        'gjr',
        'gjr.group_id = g.id AND gjr.user_id = :userId AND gjr.status = :pendingRequest',
        { userId, pendingRequest: RequestStatus.PENDING },
      )
      .addSelect('gm.role', 'gm_role')
      .addSelect('gm.status', 'gm_status')
      .addSelect('gjr.status', 'gjr_status')
      .where('g.is_active = TRUE')
      .andWhere('(gm.status IS NULL OR gm.status != :banned)', {
        banned: MemberStatus.BANNED,
      })
      .andWhere(
        new Brackets((b) => {
          geohashPrefixes.forEach((cell, i) => {
            b.orWhere(`g.anchor_geohash LIKE :p${i}`, {
              [`p${i}`]: `${cell}%`,
            });
          });
        }),
      )
      .getRawAndEntities();

    return result.entities.map((entity, i) => {
      const raw = result.raw[i] as {
        gm_role: MemberRole | null;
        gm_status: MemberStatus | null;
        gjr_status: RequestStatus | null;
      };
      const requestStatus = raw.gjr_status ?? null;
      const status =
        raw.gm_status ??
        (requestStatus === RequestStatus.PENDING ? MemberStatus.PENDING : null);
      const role = raw.gm_role ?? null;
      return {
        group: GroupMapper.toDomain(entity),
        memberStatus: status,
        myRole: status === MemberStatus.ACTIVE ? role : null,
      };
    });
  }

  async findMember(
    groupId: string,
    userId: string,
  ): Promise<GroupMember | null> {
    const entity = await this.membersRepo.findOneBy({ groupId, userId });
    return entity ? GroupMapper.memberToDomain(entity) : null;
  }

  async addMember(
    groupId: string,
    userId: string,
    role: MemberRole,
    status: MemberStatus,
  ): Promise<GroupMember> {
    const entity = this.membersRepo.create({
      groupId,
      userId,
      role,
      status,
      lastReadAt: status === MemberStatus.ACTIVE ? new Date() : null,
    });
    const saved = await this.membersRepo.save(entity);
    return GroupMapper.memberToDomain(saved);
  }

  async incrementMemberCount(groupId: string): Promise<void> {
    await this.groupsRepo.increment({ id: groupId }, 'memberCount', 1);
  }

  async decrementMemberCount(groupId: string): Promise<void> {
    await this.groupsRepo.decrement({ id: groupId }, 'memberCount', 1);
  }

  async removeMember(groupId: string, userId: string): Promise<void> {
    await this.membersRepo.delete({ groupId, userId });
  }

  async updateMemberStatus(
    groupId: string,
    userId: string,
    status: MemberStatus,
  ): Promise<void> {
    await this.membersRepo.update({ groupId, userId }, { status });
  }

  async findPendingJoinRequest(
    groupId: string,
    userId: string,
  ): Promise<GroupJoinRequest | null> {
    const entity = await this.requestsRepo.findOneBy({
      groupId,
      userId,
      status: RequestStatus.PENDING,
    });
    return entity ? GroupMapper.requestToDomain(entity) : null;
  }

  async createJoinRequest(
    groupId: string,
    userId: string,
    status: RequestStatus,
  ): Promise<GroupJoinRequest> {
    const entity = this.requestsRepo.create({ groupId, userId, status });
    const saved = await this.requestsRepo.save(entity);
    return GroupMapper.requestToDomain(saved);
  }

  async listJoinRequestsByStatus(
    groupId: string,
    status: RequestStatus,
  ): Promise<JoinRequestWithRequester[]> {
    const rows = await this.requestsRepo
      .createQueryBuilder('r')
      .innerJoin(UserEntity, 'u', 'u.id = r.user_id')
      .where('r.group_id = :groupId', { groupId })
      .andWhere('r.status = :status', { status })
      .orderBy('r.created_at', 'ASC')
      .select([
        'r.id AS r_id',
        'r.group_id AS r_group_id',
        'r.user_id AS r_user_id',
        'r.status AS r_status',
        'r.created_at AS r_created_at',
        'r.resolved_at AS r_resolved_at',
        'r.resolved_by AS r_resolved_by',
        'u.display_name AS u_display_name',
      ])
      .getRawMany<{
        r_id: string;
        r_group_id: string;
        r_user_id: string;
        r_status: RequestStatus;
        r_created_at: Date;
        r_resolved_at: Date | null;
        r_resolved_by: string | null;
        u_display_name: string;
      }>();

    return rows.map((row) => ({
      request: new GroupJoinRequest(
        row.r_id,
        row.r_group_id,
        row.r_user_id,
        row.r_status,
        row.r_created_at,
        row.r_resolved_at,
        row.r_resolved_by,
      ),
      requesterDisplayName: row.u_display_name,
    }));
  }

  async findJoinRequestById(
    groupId: string,
    requestId: string,
  ): Promise<GroupJoinRequest | null> {
    const entity = await this.requestsRepo.findOneBy({
      id: requestId,
      groupId,
    });
    return entity ? GroupMapper.requestToDomain(entity) : null;
  }

  async updateJoinRequestStatus(
    requestId: string,
    status: RequestStatus,
    resolvedAt: Date,
    resolvedBy: string,
  ): Promise<void> {
    await this.requestsRepo.update(
      { id: requestId },
      { status, resolvedAt, resolvedBy },
    );
  }

  async leaveGroupAtomic(groupId: string, userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(GroupMemberOrmEntity, { groupId, userId });
      await manager.decrement(
        GroupOrmEntity,
        { id: groupId },
        'memberCount',
        1,
      );
    });
  }

  async approveJoinRequestAtomic(
    params: ApproveJoinRequestAtomicParams,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        GroupJoinRequestOrmEntity,
        { id: params.requestId },
        {
          status: RequestStatus.APPROVED,
          resolvedAt: params.resolvedAt,
          resolvedBy: params.resolverId,
        },
      );

      const existing = await manager.findOneBy(GroupMemberOrmEntity, {
        groupId: params.groupId,
        userId: params.userId,
      });

      if (!existing) {
        const member = manager.create(GroupMemberOrmEntity, {
          groupId: params.groupId,
          userId: params.userId,
          role: MemberRole.MEMBER,
          status: MemberStatus.ACTIVE,
          lastReadAt: new Date(),
        });
        await manager.save(member);
        await manager.increment(
          GroupOrmEntity,
          { id: params.groupId },
          'memberCount',
          1,
        );
        return;
      }

      // Already a non-BANNED member (e.g. PENDING or ACTIVE): leave as-is.
      // The use case guards against calling this for a BANNED member.
    });
  }

  async banMemberAtomic(groupId: string, userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOneBy(GroupMemberOrmEntity, {
        groupId,
        userId,
      });
      if (!existing) return;
      if (existing.status === MemberStatus.BANNED) return;

      const wasActive = existing.status === MemberStatus.ACTIVE;
      await manager.update(
        GroupMemberOrmEntity,
        { groupId, userId },
        { status: MemberStatus.BANNED },
      );
      if (wasActive) {
        await manager.decrement(
          GroupOrmEntity,
          { id: groupId },
          'memberCount',
          1,
        );
      }
    });
  }

  async unbanMemberAtomic(groupId: string, userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOneBy(GroupMemberOrmEntity, {
        groupId,
        userId,
      });
      if (!existing) return;
      if (existing.status !== MemberStatus.BANNED) return;
      await manager.delete(GroupMemberOrmEntity, { groupId, userId });
    });
  }

  async deleteGroupAtomic(groupId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.query('DELETE FROM messages WHERE group_id = $1', [
        groupId,
      ]);
      await manager.query(
        'DELETE FROM group_join_requests WHERE group_id = $1',
        [groupId],
      );
      await manager.delete(GroupMemberOrmEntity, { groupId });
      await manager.delete(GroupOrmEntity, { id: groupId });
    });
  }

  async listMembersPaginated(
    groupId: string,
    limit: number,
    cursor?: string,
  ): Promise<PaginatedMembers> {
    const qb = this.membersRepo
      .createQueryBuilder('m')
      .innerJoin(UserEntity, 'u', 'u.id = m.user_id')
      .where('m.group_id = :groupId', { groupId })
      .andWhere('m.status = :status', { status: MemberStatus.ACTIVE });

    if (cursor) {
      qb.andWhere('m.joined_at > :cursor', { cursor });
    }

    qb.orderBy('m.joined_at', 'ASC')
      .addOrderBy('m.id', 'ASC')
      .limit(limit + 1)
      .select([
        'm.id AS m_id',
        'm.user_id AS m_user_id',
        'm.role AS m_role',
        'm.joined_at AS m_joined_at',
        'u.display_name AS u_display_name',
        'u.avatar_url AS u_avatar_url',
      ]);

    const raw = await qb.getRawMany<{
      m_id: string;
      m_user_id: string;
      m_role: MemberRole;
      m_joined_at: Date;
      u_display_name: string;
      u_avatar_url: string | null;
    }>();

    const hasMore = raw.length > limit;
    const page = hasMore ? raw.slice(0, limit) : raw;
    const last = page.length > 0 ? page[page.length - 1] : null;
    const nextCursor = hasMore && last ? last.m_joined_at.toISOString() : null;

    return {
      rows: page.map((row) => ({
        userId: row.m_user_id,
        displayName: row.u_display_name,
        avatarUrl: row.u_avatar_url,
        role: row.m_role,
        joinedAt: row.m_joined_at,
      })),
      nextCursor,
    };
  }

  async listMyGroupsByActivity(
    userId: string,
    limit: number,
    cursor?: MyGroupsCursor,
  ): Promise<PaginatedMyGroups> {
    const params: unknown[] = [userId, limit + 1];
    let cursorClause = '';
    if (cursor) {
      params.push(cursor.lastActivityAt.toISOString(), cursor.groupId);
      cursorClause = `AND (COALESCE(lm.created_at, gm.joined_at), g.id) < ($3::timestamptz, $4::uuid)`;
    }

    // LATERAL subquery picks the most recent non-deleted message per group in
    // a single round-trip; the outer LEFT JOIN to users then resolves the
    // sender's display_name. COALESCE(lm.created_at, gm.joined_at) is the
    // sort key (last activity, falling back to membership age for groups with
    // no messages yet).
    const sql = `
      SELECT
        g.id           AS g_id,
        g.name         AS g_name,
        g.anchor_type  AS g_anchor_type,
        g.anchor_label AS g_anchor_label,
        g.member_count AS g_member_count,
        gm.role        AS gm_role,
        gm.joined_at   AS gm_joined_at,
${MY_GROUP_SUMMARY_SELECT_SQL}
      FROM groups g
      INNER JOIN group_members gm ON gm.group_id = g.id
${MY_GROUP_SUMMARY_JOINS_SQL}
      WHERE gm.user_id = $1
        AND gm.status = 'active'
        AND g.is_active = true
        ${cursorClause}
      ORDER BY COALESCE(lm.created_at, gm.joined_at) DESC, g.id DESC
      LIMIT $2
    `;

    const raw = await this.dataSource.query<MyGroupListRawRow[]>(sql, params);

    const hasMore = raw.length > limit;
    const page = hasMore ? raw.slice(0, limit) : raw;
    const last = page.length > 0 ? page[page.length - 1] : null;
    const nextCursor =
      hasMore && last
        ? { lastActivityAt: last.last_activity_at, groupId: last.g_id }
        : null;

    return {
      rows: page.map((row) => ({
        id: row.g_id,
        name: row.g_name,
        anchorType: row.g_anchor_type,
        anchorLabel: row.g_anchor_label,
        // pg may return BIGINT/NUMERIC as a string; coerce defensively.
        memberCount: Number(row.g_member_count),
        myRole: row.gm_role,
        lastActivityAt: row.last_activity_at,
        lastReadAt: row.gm_last_read_at,
        unreadCount: Number(row.unread_count),
        lastMessage: this.toLastMessage(row),
      })),
      nextCursor,
    };
  }

  async getMyGroupSummary(
    userId: string,
    groupId: string,
  ): Promise<MyGroupSummary | null> {
    const sql = `
      SELECT
        g.id AS group_id,
${MY_GROUP_SUMMARY_SELECT_SQL}
      FROM groups g
      INNER JOIN group_members gm ON gm.group_id = g.id
${MY_GROUP_SUMMARY_JOINS_SQL}
      WHERE gm.user_id = $1
        AND gm.group_id = $2
        AND gm.status = 'active'
        AND g.is_active = true
      LIMIT 1
    `;

    const rows = await this.dataSource.query<MyGroupSummaryRawRow[]>(sql, [
      userId,
      groupId,
    ]);

    const row = rows[0];
    if (!row) return null;

    return this.toMyGroupSummary(row);
  }

  private toMyGroupSummary(row: MyGroupSummaryRawRow): MyGroupSummary {
    return {
      groupId: row.group_id,
      lastActivityAt: row.last_activity_at,
      lastReadAt: row.gm_last_read_at,
      unreadCount: Number(row.unread_count),
      lastMessage: this.toLastMessage(row),
    };
  }

  private toLastMessage(row: MyGroupSummaryColumns): MyGroupLastMessage | null {
    if (!row.lm_created_at || row.u_display_name === null) return null;
    return {
      content: row.lm_content,
      senderName: row.u_display_name,
      createdAt: row.lm_created_at,
    };
  }

  async markGroupRead(
    userId: string,
    groupId: string,
    readAt: Date,
  ): Promise<boolean> {
    const rows = await this.dataSource.query<Array<{ id: string }>>(
      `
        UPDATE group_members gm
        SET last_read_at = GREATEST(
          COALESCE(last_read_at, '-infinity'::timestamptz),
          $3::timestamptz
        )
        WHERE gm.user_id = $1
          AND gm.group_id = $2
          AND gm.status = 'active'
          AND EXISTS (
            SELECT 1
            FROM groups g
            WHERE g.id = gm.group_id
              AND g.is_active = true
          )
        RETURNING id
      `,
      [userId, groupId, readAt.toISOString()],
    );

    return rows.length > 0;
  }
}
