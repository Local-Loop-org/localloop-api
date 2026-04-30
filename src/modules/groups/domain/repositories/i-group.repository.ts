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

export interface MemberRow {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: MemberRole;
  joinedAt: Date;
}

export interface PaginatedMembers {
  rows: MemberRow[];
  nextCursor: string | null;
}

export interface MyGroupLastMessage {
  content: string | null;
  senderName: string;
  createdAt: Date;
}

export interface MyGroupRow {
  id: string;
  name: string;
  anchorType: AnchorType;
  anchorLabel: string;
  memberCount: number;
  myRole: MemberRole;
  lastActivityAt: Date;
  lastMessage: MyGroupLastMessage | null;
}

export interface MyGroupsCursor {
  lastActivityAt: Date;
  groupId: string;
}

export interface PaginatedMyGroups {
  rows: MyGroupRow[];
  nextCursor: MyGroupsCursor | null;
}

export interface ApproveJoinRequestAtomicParams {
  requestId: string;
  groupId: string;
  userId: string;
  resolverId: string;
  resolvedAt: Date;
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
  decrementMemberCount(groupId: string): Promise<void>;
  removeMember(groupId: string, userId: string): Promise<void>;
  updateMemberStatus(
    groupId: string,
    userId: string,
    status: MemberStatus,
  ): Promise<void>;

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
  findJoinRequestById(
    groupId: string,
    requestId: string,
  ): Promise<GroupJoinRequest | null>;
  updateJoinRequestStatus(
    requestId: string,
    status: RequestStatus,
    resolvedAt: Date,
    resolvedBy: string,
  ): Promise<void>;

  /**
   * Atomically leave a group: hard-delete the member row and decrement memberCount.
   */
  leaveGroupAtomic(groupId: string, userId: string): Promise<void>;

  /**
   * Atomically approve a pending join request: mark request approved, upsert an
   * ACTIVE member row, and increment memberCount iff a new member row was inserted
   * (or an existing non-BANNED row was reactivated from a non-ACTIVE state).
   */
  approveJoinRequestAtomic(
    params: ApproveJoinRequestAtomicParams,
  ): Promise<void>;

  /**
   * Atomically ban a member: set status = BANNED and decrement memberCount iff
   * the previous status was ACTIVE.
   */
  banMemberAtomic(groupId: string, userId: string): Promise<void>;

  listMembersPaginated(
    groupId: string,
    limit: number,
    cursor?: string,
  ): Promise<PaginatedMembers>;

  /**
   * List the caller's active group memberships, ordered by latest activity DESC
   * (most recent non-deleted message timestamp, falling back to joined_at when
   * the group has no messages yet). Inactive memberships and inactive groups
   * are excluded.
   */
  listMyGroupsByActivity(
    userId: string,
    limit: number,
    cursor?: MyGroupsCursor,
  ): Promise<PaginatedMyGroups>;
}

export const GROUP_REPOSITORY = Symbol('GROUP_REPOSITORY');
