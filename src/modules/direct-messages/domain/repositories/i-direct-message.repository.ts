import { MediaType } from '@localloop/shared-types';
import { LastMessageSummary, PaginatedResult } from '@/shared/pagination/types';
import { DirectMessage } from '../entities/direct-message.entity';

export interface CreateDirectMessageData {
  senderId: string;
  recipientId: string;
  content: string | null;
  mediaUrl: string | null;
  mediaType: MediaType | null;
  replyToMessageId?: string | null;
}

export interface CreateDmRequestData {
  senderId: string;
  recipientId: string;
  content: string | null;
}

export interface DirectMessageRowReplyTo {
  id: string;
  authorId: string;
  snippet: string | null;
  isDeleted: boolean;
}

export interface DirectMessageRow {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  recipientId: string;
  content: string | null;
  mediaUrl: string | null;
  mediaType: MediaType | null;
  isDeleted: boolean;
  editedAt: Date | null;
  replyTo: DirectMessageRowReplyTo | null;
  createdAt: Date;
}

export interface DmConversationRow {
  peerId: string;
  peerName: string;
  peerAvatarUrl: string | null;
  lastMessageContent: string | null;
  lastMessageSenderName: string;
  lastMessageAt: Date;
  lastReadAt: Date | null;
  unreadCount: number;
  archived: boolean;
}

/**
 * Single-pair summary for inbox liveness emits (DM-TASK-E). Mirrors
 * `MyGroupSummary` in the groups module — `peerId` instead of `groupId`,
 * plus DM-specific `archived` flag.
 */
export interface DmSummary {
  peerId: string;
  lastActivityAt: Date;
  lastMessage: LastMessageSummary | null;
  lastReadAt: Date | null;
  unreadCount: number;
  archived: boolean;
}

export interface DmConversationReadState {
  lastReadAt: Date | null;
  peerLastReadAt: Date | null;
}

export interface DmInboxCursor {
  lastMessageAt: Date;
  peerId: string;
}

export interface DmRequestRow {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  content: string | null;
  createdAt: Date;
}

export interface DmRequestCursor {
  createdAt: Date;
  requestId: string;
}

/** Minimal row shape used for auth + existence checks on a single dm_requests row. */
export interface DmRequestRecord {
  id: string;
  senderId: string;
  recipientId: string;
  content: string | null;
  createdAt: Date;
}

export interface DmExceptionRow {
  peerId: string;
  peerName: string;
  peerAvatarUrl: string | null;
  createdAt: Date;
}

export interface DmExceptionCursor {
  createdAt: Date;
  peerId: string;
}

export interface DmExceptionCandidateRow {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface DmExceptionCandidateCursor {
  displayName: string;
  userId: string;
}

export interface IDirectMessageRepository {
  /**
   * Direct-delivery write. In one transaction: inserts the message row, writes
   * the sender→recipient permission exception, and eager-inits the sender's
   * conversation_state row (last_read_at = now()). Side-table writes are
   * idempotent (ON CONFLICT DO NOTHING) so repeat sends are safe.
   */
  createDirectDeliveryAtomic(
    data: CreateDirectMessageData,
  ): Promise<DirectMessage>;
  /** Lean single-row lookup used for reply-target validation. */
  findById(id: string): Promise<DirectMessage | null>;
  findByIdWithSender(id: string): Promise<DirectMessageRow | null>;
  listConversation(
    userAId: string,
    userBId: string,
    limit: number,
    before?: string,
  ): Promise<PaginatedResult<DirectMessageRow>>;
  /**
   * Caller + peer read watermarks for a delivered DM thread. Returns null when
   * the pair has no non-deleted direct_messages row; missing state rows surface
   * as null read timestamps.
   */
  getConversationReadState(
    userId: string,
    peerId: string,
  ): Promise<DmConversationReadState | null>;
  hasPermissionException(userId: string, peerId: string): Promise<boolean>;
  createRequest(data: CreateDmRequestData): Promise<{ id: string }>;
  /**
   * Single-row lookup on dm_requests. Used by the use cases to drive the
   * 404-vs-403 decision before mutating. Returns null when no row exists.
   */
  findRequestById(requestId: string): Promise<DmRequestRecord | null>;
  /**
   * Materializes a held dm_requests row into direct_messages in one transaction:
   *   1) SELECT … FOR UPDATE on the request (throws if gone — covers accept-then-accept)
   *   2) INSERT into direct_messages preserving the original created_at
   *   3) idempotent INSERT into dm_permission_exceptions (recipient → sender)
   *   4) idempotent INSERT into dm_conversation_state for the sender's row
   *   5) DELETE the dm_requests row
   * Returns the materialized message with sender display fields joined.
   */
  acceptRequestAtomic(requestId: string): Promise<DirectMessageRow>;
  /** Idempotent DELETE on dm_requests by id. */
  declineRequest(requestId: string): Promise<void>;
  listInbox(
    userId: string,
    limit: number,
    cursor?: DmInboxCursor,
  ): Promise<PaginatedResult<DmConversationRow, DmInboxCursor>>;
  listRequests(
    userId: string,
    limit: number,
    cursor?: DmRequestCursor,
  ): Promise<PaginatedResult<DmRequestRow, DmRequestCursor>>;
  /**
   * Paginated list of the caller's `dm_permission_exceptions` rows. Joins
   * `users` for display name + avatar; inactive peers are filtered out (the
   * row remains in the table; the list just hides them — DM-TASK-G is the
   * placeholder-substitution rule for read paths that must keep them visible).
   */
  listExceptions(
    userId: string,
    limit: number,
    cursor?: DmExceptionCursor,
  ): Promise<PaginatedResult<DmExceptionRow, DmExceptionCursor>>;
  /**
   * Paginated list of active users who share at least one ACTIVE group
   * membership with the caller and are not already on the caller's
   * `dm_permission_exceptions` list. Ordering: lower(display_name) ASC,
   * user_id ASC. Optional case-insensitive substring filter on display_name
   * (caller is responsible for trimming `q`; empty/whitespace should be
   * passed as undefined).
   */
  listExceptionCandidates(
    callerId: string,
    q: string | undefined,
    cursor: DmExceptionCandidateCursor | undefined,
    limit: number,
  ): Promise<
    PaginatedResult<DmExceptionCandidateRow, DmExceptionCandidateCursor>
  >;
  /** Idempotent UPSERT — adding the same pair twice is a no-op. */
  addException(userId: string, peerId: string): Promise<void>;
  /** Idempotent DELETE — removing a non-existent pair succeeds. */
  removeException(userId: string, peerId: string): Promise<void>;
  /**
   * UPSERT `dm_conversation_state(userId, peerId).last_read_at = readAt`.
   * Returns the new last_read_at so the caller can echo it back to the client.
   * Lazy-initializes the row if it does not already exist (no preconditions).
   */
  markRead(userId: string, peerId: string, readAt: Date): Promise<Date>;
  /**
   * UPSERT `dm_conversation_state(userId, peerId).archived = archived`.
   * Idempotent — repeat calls with the same value are a no-op. Does NOT touch
   * `last_read_at` on update (existing read-state preserved).
   */
  setArchived(userId: string, peerId: string, archived: boolean): Promise<void>;
  /**
   * Per-pair summary for inbox liveness emits. Returns null when no message has
   * been exchanged with the peer (a row in `dm_conversation_state` alone is not
   * enough — there must be at least one row in `direct_messages` to surface).
   */
  getDmSummary(userId: string, peerId: string): Promise<DmSummary | null>;
  /** Idempotent soft delete: flips `is_deleted` to true on a single row. */
  markAsDeleted(id: string): Promise<void>;
  /**
   * Idempotent edit: updates `content` + `edited_at` only while `is_deleted = false`.
   * No-op against a soft-deleted row.
   */
  markAsEdited(id: string, content: string, editedAt: Date): Promise<void>;
}

export const DIRECT_MESSAGE_REPOSITORY = Symbol('DIRECT_MESSAGE_REPOSITORY');
