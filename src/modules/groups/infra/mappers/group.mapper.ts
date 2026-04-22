import { Group } from '../../domain/entities/group.entity';
import { GroupMember } from '../../domain/entities/group-member.entity';
import { GroupJoinRequest } from '../../domain/entities/group-join-request.entity';
import { GroupOrmEntity } from '../repositories/group.entity';
import { GroupMemberOrmEntity } from '../repositories/group-member.entity';
import { GroupJoinRequestOrmEntity } from '../repositories/group-join-request.entity';

export class GroupMapper {
  static toDomain(e: GroupOrmEntity): Group {
    return new Group(
      e.id,
      e.name,
      e.description,
      e.anchorType,
      e.anchorGeohash,
      e.anchorLabel,
      e.privacy,
      e.ownerId,
      e.memberCount,
      e.isActive,
      e.createdAt,
    );
  }

  static memberToDomain(e: GroupMemberOrmEntity): GroupMember {
    return new GroupMember(
      e.id,
      e.groupId,
      e.userId,
      e.role,
      e.status,
      e.joinedAt,
    );
  }

  static requestToDomain(e: GroupJoinRequestOrmEntity): GroupJoinRequest {
    return new GroupJoinRequest(
      e.id,
      e.groupId,
      e.userId,
      e.status,
      e.createdAt,
      e.resolvedAt,
      e.resolvedBy,
    );
  }
}
