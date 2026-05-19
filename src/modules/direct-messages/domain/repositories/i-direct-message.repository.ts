import { MediaType } from '@localloop/shared-types';
import { PaginatedResult } from '@/shared/pagination/types';
import { DirectMessage } from '../entities/direct-message.entity';

export interface CreateDirectMessageData {
  senderId: string;
  recipientId: string;
  content: string | null;
  mediaUrl: string | null;
  mediaType: MediaType | null;
}

export interface CreateDmRequestData {
  senderId: string;
  recipientId: string;
  content: string | null;
}

export interface DirectMessageRow {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  recipientId: string;
  content: string | null;
  mediaUrl: string | null;
  mediaType: MediaType | null;
  createdAt: Date;
}

export interface DmConversationRow {
  peerId: string;
  peerName: string;
  peerAvatarUrl: string | null;
  lastMessageContent: string | null;
  lastMessageSenderName: string;
  lastMessageAt: Date;
  unreadCount: number;
  archived: boolean;
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
  findByIdWithSender(id: string): Promise<DirectMessageRow | null>;
  listConversation(
    userAId: string,
    userBId: string,
    limit: number,
    before?: string,
  ): Promise<PaginatedResult<DirectMessageRow>>;
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
  /** Idempotent UPSERT — adding the same pair twice is a no-op. */
  addException(userId: string, peerId: string): Promise<void>;
  /** Idempotent DELETE — removing a non-existent pair succeeds. */
  removeException(userId: string, peerId: string): Promise<void>;
}

export const DIRECT_MESSAGE_REPOSITORY = Symbol('DIRECT_MESSAGE_REPOSITORY');
