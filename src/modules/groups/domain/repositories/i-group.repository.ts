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
import { LastMessageSummary, PaginatedResult } from '@/shared/pagination/types';

export interface CreateGroupData {
  name: string;
  description: string | null;
  anchorType: AnchorType;
  anchorGeohash: string;
  anchorLat: number;
  anchorLng: number;
  anchorLabel: string | null;
  privacy: GroupPrivacy;
  radiusKm: number;
  ownerId: string;
  memberCount: number;
}

export interface UpdateGroupData {
  name?: string;
  description?: string | null;
  anchorLabel?: string | null;
  anchorGeohash?: string;
  anchorLat?: number;
  anchorLng?: number;
  privacy?: GroupPrivacy;
  radiusKm?: number;
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

export interface MyGroupRow {
  id: string;
  name: string;
  anchorType: AnchorType;
  anchorLabel: string | null;
  memberCount: number;
  myRole: MemberRole;
  lastActivityAt: Date;
  lastMessage: LastMessageSummary | null;
  lastReadAt: Date | null;
  unreadCount: number;
}

export interface MyGroupSummary {
  groupId: string;
  lastActivityAt: Date;
  lastMessage: LastMessageSummary | null;
  lastReadAt: Date | null;
  unreadCount: number;
}

export interface MyGroupsCursor {
  lastActivityAt: Date;
  groupId: string;
}

export interface ApproveJoinRequestAtomicParams {
  requestId: string;
  groupId: string;
  userId: string;
  resolverId: string;
  resolvedAt: Date;
}

export interface NearbyGroupRow {
  group: Group;
  /** null unless the caller is an ACTIVE member */
  myRole: MemberRole | null;
  /** null when the caller has no row in group_members */
  memberStatus: MemberStatus | null;
}

export interface IGroupRepository {
  createGroupWithOwner(data: CreateGroupData): Promise<Group>;
  findById(id: string): Promise<Group | null>;
  updateGroup(id: string, data: UpdateGroupData): Promise<Group>;
  /**
   * Find active groups whose `anchor_geohash` starts with any of the given
   * prefixes, enriched with the caller's membership status.
   * Banned-from groups are excluded entirely.
   */
  findNearby(
    userId: string,
    geohashPrefixes: string[],
  ): Promise<NearbyGroupRow[]>;

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
  updateMemberRole(
    groupId: string,
    userId: string,
    role: MemberRole,
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

  /**
   * Atomically unban a member by hard-deleting their `group_members` row.
   * Does nothing if the row is missing or its status is not BANNED.
   * memberCount is unchanged because BANNED rows are not counted.
   */
  unbanMemberAtomic(groupId: string, userId: string): Promise<void>;

  /**
   * Atomically delete a group and all its related rows
   * (messages → join_requests → members → group).
   */
  deleteGroupAtomic(groupId: string): Promise<void>;

  listMembersPaginated(
    groupId: string,
    limit: number,
    cursor: string | undefined,
    status: MemberStatus,
  ): Promise<PaginatedResult<MemberRow>>;

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
  ): Promise<PaginatedResult<MyGroupRow, MyGroupsCursor>>;

  /**
   * Return a user-specific summary for one active membership.
   */
  getMyGroupSummary(
    userId: string,
    groupId: string,
  ): Promise<MyGroupSummary | null>;

  /**
   * Persist the caller's read watermark for one active membership.
   * Returns false when the caller is not an active member.
   */
  markGroupRead(
    userId: string,
    groupId: string,
    readAt: Date,
  ): Promise<boolean>;

  /**
   * Returns true if both users are ACTIVE members of at least one common group.
   * Used by the DM `MEMBERS` policy to gate sending without listing all groups.
   */
  hasSharedActiveGroup(userAId: string, userBId: string): Promise<boolean>;
}

export const GROUP_REPOSITORY = Symbol('GROUP_REPOSITORY');
