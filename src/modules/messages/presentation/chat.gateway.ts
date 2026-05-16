import { Inject, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import {
  ChatSocketEvents,
  GroupSummaryUpdate,
  GroupPrivacy,
  MemberStatus,
  PresenceUpdate,
} from '@localloop/shared-types';

import { User } from '@/modules/auth/domain/entities/user.entity';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '@/modules/auth/domain/repositories/i-user.repository';
import {
  GROUP_REPOSITORY,
  IGroupRepository,
  MyGroupSummary,
} from '@/modules/groups/domain/repositories/i-group.repository';
import { SendGroupMessagePushNotificationsUseCase } from '@/modules/notifications/application/use-cases/send-group-message-push-notifications/send-group-message-push-notifications.use-case';
import { SendDirectMessageUseCase } from '@/modules/direct-messages/application/use-cases/send-direct-message/send-direct-message.use-case';
import { SendMessageResponseDto } from '../application/use-cases/send-message/send-message.dto';
import { SendMessageUseCase } from '../application/use-cases/send-message/send-message.use-case';

interface JoinGroupPayload {
  groupId: string;
}

interface WatchPresencePayload {
  groupIds: string[];
}

interface WatchGroupSummariesPayload {
  groupIds: string[];
}

interface MarkGroupReadPayload {
  groupId: string;
}

interface SendMessagePayload {
  groupId: string;
  content: string | null;
  storageKey: string | null;
  mediaType: 'image' | 'video' | null;
}

interface JoinDmPayload {
  userId: string;
}

interface SendDmPayload {
  recipientId: string;
  content: string | null;
}

interface AuthedSocket extends Socket {
  data: { user: User };
}

const GROUP_ROOM_PREFIX = 'group:';
const PRESENCE_ROOM_PREFIX = 'presence:';
const GROUP_SUMMARY_ROOM_PREFIX = 'group_summary:';
const DM_ROOM_PREFIX = 'dm:';
const MAX_WATCHED_GROUPS = 50;
const groupRoom = (groupId: string) => `${GROUP_ROOM_PREFIX}${groupId}`;
const presenceRoom = (groupId: string) => `${PRESENCE_ROOM_PREFIX}${groupId}`;
const groupSummaryRoom = (groupId: string) =>
  `${GROUP_SUMMARY_ROOM_PREFIX}${groupId}`;
const groupIdFromRoom = (room: string) => room.slice(GROUP_ROOM_PREFIX.length);
const dmRoom = (userAId: string, userBId: string): string => {
  const [a, b] = [userAId, userBId].sort();
  return `${DM_ROOM_PREFIX}${a}:${b}`;
};

@WebSocketGateway({ namespace: '/chat', cors: { origin: '*' } })
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server!: Namespace;

  constructor(
    private readonly jwtService: JwtService,
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    @Inject(GROUP_REPOSITORY) private readonly groupRepo: IGroupRepository,
    private readonly sendMessage: SendMessageUseCase,
    private readonly sendGroupMessagePush: SendGroupMessagePushNotificationsUseCase,
    private readonly sendDirectMessage: SendDirectMessageUseCase,
  ) {}

  afterInit(server: Namespace): void {
    server.use(async (socket: Socket, next: (err?: Error) => void) => {
      const token = this.extractToken(socket);
      if (!token) {
        next(new Error('UNAUTHENTICATED'));
        return;
      }
      try {
        const payload = await this.jwtService.verifyAsync<{ sub: string }>(
          token,
        );
        const user = await this.userRepo.findById(payload.sub);
        if (!user || !user.isActive) {
          next(new Error('UNAUTHENTICATED'));
          return;
        }
        (socket as AuthedSocket).data.user = user;
        next();
      } catch (err) {
        this.logger.warn(
          `Socket ${socket.id} failed auth: ${(err as Error).message}`,
        );
        next(new Error('UNAUTHENTICATED'));
      }
    });
  }

  handleConnection(socket: Socket): void {
    socket.on('disconnecting', () => {
      const groupRooms = [...socket.rooms].filter((r) =>
        r.startsWith(GROUP_ROOM_PREFIX),
      );
      if (groupRooms.length === 0) return;
      setImmediate(() => {
        for (const room of groupRooms) {
          void this.emitPresence(groupIdFromRoom(room));
        }
      });
    });
  }

  handleDisconnect(socket: Socket): void {
    this.logger.debug(`Socket ${socket.id} disconnected`);
  }

  private async emitPresence(groupId: string): Promise<void> {
    const room = groupRoom(groupId);
    const sockets = await this.server.in(room).fetchSockets();
    const payload: PresenceUpdate = { groupId, count: sockets.length };
    this.server.to(room).emit(ChatSocketEvents.PRESENCE_UPDATE, payload);
    this.server
      .to(presenceRoom(groupId))
      .emit(ChatSocketEvents.PRESENCE_UPDATE, payload);
  }

  private normalizeGroupIds(
    payload: { groupIds?: unknown } | undefined,
  ): string[] {
    if (!payload || !Array.isArray(payload.groupIds)) return [];
    return [...new Set(payload.groupIds)]
      .filter((id) => typeof id === 'string' && id.length > 0)
      .slice(0, MAX_WATCHED_GROUPS);
  }

  private async canWatchPresence(
    groupId: string,
    userId: string,
  ): Promise<boolean> {
    const group = await this.groupRepo.findById(groupId);
    if (!group || !group.isActive) return false;
    const member = await this.groupRepo.findMember(groupId, userId);
    if (member?.status === MemberStatus.BANNED) return false;
    if (group.privacy === GroupPrivacy.OPEN) return true;

    return member?.status === MemberStatus.ACTIVE;
  }

  private async canWatchGroupSummary(
    groupId: string,
    userId: string,
  ): Promise<boolean> {
    const member = await this.groupRepo.findMember(groupId, userId);
    return member?.status === MemberStatus.ACTIVE;
  }

  private toGroupSummaryUpdate(summary: MyGroupSummary): GroupSummaryUpdate {
    return {
      groupId: summary.groupId,
      lastActivityAt: summary.lastActivityAt.toISOString(),
      lastReadAt: summary.lastReadAt ? summary.lastReadAt.toISOString() : null,
      unreadCount: summary.unreadCount,
      lastMessage: summary.lastMessage
        ? {
            content: summary.lastMessage.content,
            senderName: summary.lastMessage.senderName,
            createdAt: summary.lastMessage.createdAt.toISOString(),
          }
        : null,
    };
  }

  private async emitGroupSummaryToSocket(
    socket: AuthedSocket,
    groupId: string,
  ): Promise<void> {
    const summary = await this.groupRepo.getMyGroupSummary(
      socket.data.user.id,
      groupId,
    );
    if (!summary) return;
    socket.emit(
      ChatSocketEvents.GROUP_SUMMARY_UPDATE,
      this.toGroupSummaryUpdate(summary),
    );
  }

  private async emitGroupSummary(groupId: string): Promise<void> {
    const sockets = await this.server
      .in(groupSummaryRoom(groupId))
      .fetchSockets();
    const payloads = new Map<string, GroupSummaryUpdate | null>();

    for (const socket of sockets) {
      const summarySocket = socket as unknown as {
        data?: { user?: User };
        emit: (event: string, payload: GroupSummaryUpdate) => void;
      };
      const userId = summarySocket.data?.user?.id;
      if (!userId) continue;

      if (!payloads.has(userId)) {
        const summary = await this.groupRepo.getMyGroupSummary(userId, groupId);
        payloads.set(
          userId,
          summary ? this.toGroupSummaryUpdate(summary) : null,
        );
      }

      const payload = payloads.get(userId);
      if (payload) {
        summarySocket.emit(ChatSocketEvents.GROUP_SUMMARY_UPDATE, payload);
      }
    }
  }

  @SubscribeMessage(ChatSocketEvents.JOIN_GROUP)
  async onJoinGroup(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() payload: JoinGroupPayload,
  ): Promise<{ ok: boolean }> {
    const userId = socket.data.user.id;
    const member = await this.groupRepo.findMember(payload.groupId, userId);
    if (!member || member.status !== MemberStatus.ACTIVE) {
      socket.emit(ChatSocketEvents.ERROR, {
        code: 'FORBIDDEN',
        message: 'Not an active member of this group',
      });
      return { ok: false };
    }
    await socket.join(groupRoom(payload.groupId));
    await this.emitPresence(payload.groupId);
    return { ok: true };
  }

  @SubscribeMessage(ChatSocketEvents.WATCH_PRESENCE)
  async onWatchPresence(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() payload: WatchPresencePayload | undefined,
  ): Promise<{ ok: boolean }> {
    const userId = socket.data.user.id;
    const groupIds = this.normalizeGroupIds(payload);
    for (const groupId of groupIds) {
      const allowed = await this.canWatchPresence(groupId, userId);
      if (!allowed) continue;
      await socket.join(presenceRoom(groupId));
      await this.emitPresence(groupId);
    }
    return { ok: true };
  }

  @SubscribeMessage(ChatSocketEvents.UNWATCH_PRESENCE)
  async onUnwatchPresence(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() payload: WatchPresencePayload | undefined,
  ): Promise<void> {
    const groupIds = this.normalizeGroupIds(payload);
    await Promise.all(
      groupIds.map((groupId) => socket.leave(presenceRoom(groupId))),
    );
  }

  @SubscribeMessage(ChatSocketEvents.WATCH_GROUP_SUMMARIES)
  async onWatchGroupSummaries(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() payload: WatchGroupSummariesPayload | undefined,
  ): Promise<{ ok: boolean }> {
    const userId = socket.data.user.id;
    const groupIds = this.normalizeGroupIds(payload);
    for (const groupId of groupIds) {
      const allowed = await this.canWatchGroupSummary(groupId, userId);
      if (!allowed) continue;
      await socket.join(groupSummaryRoom(groupId));
      await this.emitGroupSummaryToSocket(socket, groupId);
    }
    return { ok: true };
  }

  @SubscribeMessage(ChatSocketEvents.UNWATCH_GROUP_SUMMARIES)
  async onUnwatchGroupSummaries(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() payload: WatchGroupSummariesPayload | undefined,
  ): Promise<void> {
    const groupIds = this.normalizeGroupIds(payload);
    await Promise.all(
      groupIds.map((groupId) => socket.leave(groupSummaryRoom(groupId))),
    );
  }

  @SubscribeMessage(ChatSocketEvents.MARK_GROUP_READ)
  async onMarkGroupRead(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() payload: MarkGroupReadPayload,
  ): Promise<{ ok: boolean }> {
    if (!payload || typeof payload.groupId !== 'string') {
      return { ok: false };
    }

    const updated = await this.groupRepo.markGroupRead(
      socket.data.user.id,
      payload.groupId,
      new Date(),
    );
    if (!updated) {
      socket.emit(ChatSocketEvents.ERROR, {
        code: 'FORBIDDEN',
        message: 'Not an active member of this group',
      });
      return { ok: false };
    }

    await this.emitGroupSummaryToSocket(socket, payload.groupId);
    return { ok: true };
  }

  @SubscribeMessage(ChatSocketEvents.LEAVE_GROUP)
  async onLeaveGroup(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() payload: JoinGroupPayload,
  ): Promise<void> {
    await socket.leave(groupRoom(payload.groupId));
    await this.emitPresence(payload.groupId);
  }

  @SubscribeMessage(ChatSocketEvents.SEND_MESSAGE)
  async onSendMessage(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() payload: SendMessagePayload,
  ): Promise<void> {
    try {
      const result = await this.sendMessage.execute(
        socket.data.user.id,
        payload.groupId,
        { content: payload.content ?? null },
      );
      this.server
        .to(groupRoom(payload.groupId))
        .emit(ChatSocketEvents.NEW_MESSAGE, result);
      void this.emitGroupSummary(result.groupId).catch(() => {
        this.logger.warn(
          `Group summary fan-out failed for message ${result.id}`,
        );
      });
      void this.notifyGroupMessage(result).catch(() => {
        this.logger.warn(
          `Push notification fan-out failed for message ${result.id}`,
        );
      });
    } catch (err) {
      const e = err as {
        response?: { error?: string; message?: string };
        message?: string;
      };
      socket.emit(ChatSocketEvents.ERROR, {
        code: e.response?.error ?? 'SEND_FAILED',
        message: e.response?.message ?? e.message ?? 'Failed to send message',
      });
    }
  }

  @SubscribeMessage(ChatSocketEvents.JOIN_DM)
  async onJoinDm(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() payload: JoinDmPayload,
  ): Promise<{ ok: boolean }> {
    const callerId = socket.data.user.id;
    if (
      !payload ||
      typeof payload.userId !== 'string' ||
      payload.userId.length === 0 ||
      payload.userId === callerId
    ) {
      socket.emit(ChatSocketEvents.ERROR, {
        code: 'BAD_REQUEST',
        message: 'Invalid DM peer',
      });
      return { ok: false };
    }
    await socket.join(dmRoom(callerId, payload.userId));
    return { ok: true };
  }

  @SubscribeMessage(ChatSocketEvents.LEAVE_DM)
  async onLeaveDm(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() payload: JoinDmPayload,
  ): Promise<void> {
    if (
      !payload ||
      typeof payload.userId !== 'string' ||
      payload.userId.length === 0
    ) {
      return;
    }
    await socket.leave(dmRoom(socket.data.user.id, payload.userId));
  }

  @SubscribeMessage(ChatSocketEvents.SEND_DM)
  async onSendDm(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() payload: SendDmPayload,
  ): Promise<void> {
    try {
      const result = await this.sendDirectMessage.execute(
        socket.data.user.id,
        payload.recipientId,
        { content: payload.content ?? null },
      );
      this.server
        .to(dmRoom(socket.data.user.id, payload.recipientId))
        .emit(ChatSocketEvents.NEW_DIRECT_MESSAGE, result);
    } catch (err) {
      const e = err as {
        response?: { error?: string; message?: string };
        message?: string;
      };
      socket.emit(ChatSocketEvents.ERROR, {
        code: e.response?.error ?? 'SEND_FAILED',
        message:
          e.response?.message ?? e.message ?? 'Failed to send direct message',
      });
    }
  }

  private async notifyGroupMessage(
    message: SendMessageResponseDto,
  ): Promise<void> {
    const sockets = await this.server
      .in(groupRoom(message.groupId))
      .fetchSockets();
    const activeUserIds = sockets
      .map((socket) => (socket.data as { user?: User } | undefined)?.user?.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    await this.sendGroupMessagePush.execute({
      groupId: message.groupId,
      messageId: message.id,
      senderId: message.senderId,
      senderName: message.senderName,
      content: message.content,
      excludedUserIds: activeUserIds,
    });
  }

  private extractToken(socket: Socket): string | null {
    const fromAuth = (socket.handshake.auth as { token?: string } | undefined)
      ?.token;
    if (typeof fromAuth === 'string' && fromAuth.length > 0) return fromAuth;
    const fromQuery = socket.handshake.query?.token;
    if (typeof fromQuery === 'string' && fromQuery.length > 0) return fromQuery;
    return null;
  }
}
