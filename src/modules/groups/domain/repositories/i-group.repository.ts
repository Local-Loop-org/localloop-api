import { Group } from '../entities/group.entity';
import { GroupMember } from '../entities/group-member.entity';
import { GroupJoinRequest } from '../entities/group-join-request.entity';
import {
  AnchorType,
  GroupPrivacy,
  MemberRole,
  MemberStatus,
  RequestStatus,
} from '@localloop/shared-types';

export interface CreateGroupData {
  name: string;
  description: string | null;
  anchorType: AnchorType;
  anchorGeohash: string;
  anchorLabel: string;
  privacy: GroupPrivacy;
  ownerId: string;
  memberCount: number;
}

export interface JoinRequestWithRequester {
  request: GroupJoinRequest;
  requesterDisplayName: string;
}

export interface IGroupRepository {
  createGroupWithOwner(data: CreateGroupData): Promise<Group>;
  findById(id: string): Promise<Group | null>;
  findNearby(geohashes: string[]): Promise<Group[]>;

  findMember(groupId: string, userId: string): Promise<GroupMember | null>;
  addMember(
    groupId: string,
    userId: string,
    role: MemberRole,
    status: MemberStatus,
  ): Promise<GroupMember>;
  incrementMemberCount(groupId: string): Promise<void>;

  findPendingJoinRequest(
    groupId: string,
    userId: string,
  ): Promise<GroupJoinRequest | null>;
  createJoinRequest(
    groupId: string,
    userId: string,
    status: RequestStatus,
  ): Promise<GroupJoinRequest>;
  listJoinRequestsByStatus(
    groupId: string,
    status: RequestStatus,
  ): Promise<JoinRequestWithRequester[]>;
}

export const GROUP_REPOSITORY = Symbol('GROUP_REPOSITORY');
