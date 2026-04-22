import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  CreateGroupData,
  IGroupRepository,
  JoinRequestWithRequester,
} from '../../domain/repositories/i-group.repository';
import { Group } from '../../domain/entities/group.entity';
import { GroupMember } from '../../domain/entities/group-member.entity';
import { GroupJoinRequest } from '../../domain/entities/group-join-request.entity';
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
        anchorLabel: data.anchorLabel,
        privacy: data.privacy,
        ownerId: data.ownerId,
        memberCount: 1,
        isActive: true,
      });
      const savedGroup = await manager.save(group);

      const member = manager.create(GroupMemberOrmEntity, {
        groupId: savedGroup.id,
        userId: data.ownerId,
        role: MemberRole.OWNER,
        status: MemberStatus.ACTIVE,
      });
      await manager.save(member);

      return GroupMapper.toDomain(savedGroup);
    });
  }

  async findById(id: string): Promise<Group | null> {
    const entity = await this.groupsRepo.findOneBy({ id });
    return entity ? GroupMapper.toDomain(entity) : null;
  }

  async findNearby(geohashes: string[]): Promise<Group[]> {
    if (geohashes.length === 0) return [];
    const entities = await this.groupsRepo.find({
      where: { anchorGeohash: In(geohashes), isActive: true },
    });
    return entities.map((e) => GroupMapper.toDomain(e));
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
    const entity = this.membersRepo.create({ groupId, userId, role, status });
    const saved = await this.membersRepo.save(entity);
    return GroupMapper.memberToDomain(saved);
  }

  async incrementMemberCount(groupId: string): Promise<void> {
    await this.groupsRepo.increment({ id: groupId }, 'memberCount', 1);
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
  ): Promise<GroupJoinRequest> {
    const entity = this.requestsRepo.create({
      groupId,
      userId,
      status: RequestStatus.PENDING,
    });
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
}
