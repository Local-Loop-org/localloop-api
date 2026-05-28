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
import {
  ChatSocketEvents,
  DirectMessageDeleted,
  MessageDeleted,
} from '@localloop/shared-types';
import { Namespace, Socket } from 'socket.io';

import {
  IUserRepository,
  USER_REPOSITORY,
} from '@/modules/auth/domain/repositories/i-user.repository';
import { DirectMessagePayload } from '@/modules/direct-messages/application/use-cases/send-direct-message/send-direct-message.dto';
import { DmInboxRealtimeService } from '@/modules/realtime/presentation/services/dm-inbox-realtime.service';
import { DmMessageRealtimeService } from '@/modules/realtime/presentation/services/dm-message-realtime.service';
import { DmPresenceRealtimeService } from '@/modules/realtime/presentation/services/dm-presence-realtime.service';
import { GroupMessageRealtimeService } from '@/modules/realtime/presentation/services/group-message-realtime.service';
import { GroupPresenceRealtimeService } from '@/modules/realtime/presentation/services/group-presence-realtime.service';
import { GroupSummaryRealtimeService } from '@/modules/realtime/presentation/services/group-summary-realtime.service';
import {
  AuthedSocket,
  JoinDmPayload,
  JoinGroupPayload,
  MarkDmReadPayload,
  MarkGroupReadPayload,
  SendDmPayload,
  SendMessagePayload,
  WatchDmPresencePayload,
  WatchGroupSummariesPayload,
  WatchPresencePayload,
} from '@/modules/realtime/realtime.types';

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
    private readonly groupPresence: GroupPresenceRealtimeService,
    private readonly groupSummary: GroupSummaryRealtimeService,
    private readonly groupMessage: GroupMessageRealtimeService,
    private readonly dmPresence: DmPresenceRealtimeService,
    private readonly dmInbox: DmInboxRealtimeService,
    private readonly dmMessage: DmMessageRealtimeService,
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
    const authedSocket = socket as AuthedSocket;
    const userId = authedSocket.data.user?.id;
    if (userId) {
      void this.dmPresence.emitDmPresenceForUser(this.server, userId);
    }

    socket.on('disconnecting', () => {
      this.groupPresence.handleDisconnecting(this.server, authedSocket);
    });
  }

  handleDisconnect(socket: Socket): void {
    const userId = (socket as AuthedSocket).data.user?.id;
    if (userId) {
      setImmediate(() => {
        void this.dmPresence.emitDmPresenceForUser(this.server, userId);
      });
    }
    this.logger.debug(`Socket ${socket.id} disconnected`);
  }

  async emitDmRequestAccepted(
    senderId: string,
    payload: DirectMessagePayload,
  ): Promise<void> {
    this.dmInbox.emitDmRequestAccepted(this.server, senderId, payload);
  }

  async emitDmSummary(userId: string, peerId: string): Promise<void> {
    await this.dmInbox.emitDmSummary(this.server, userId, peerId);
  }

  async emitDmReadSideEffects(
    readerId: string,
    peerId: string,
    lastReadAt: Date,
  ): Promise<void> {
    await this.dmMessage.emitDmReadSideEffects(
      this.server,
      readerId,
      peerId,
      lastReadAt,
    );
  }

  emitMessageDeleted(payload: MessageDeleted): void {
    this.groupMessage.emitMessageDeleted(this.server, payload);
  }

  emitDirectMessageDeleted(payload: DirectMessageDeleted): void {
    this.dmMessage.emitDirectMessageDeleted(this.server, payload);
  }

  @SubscribeMessage(ChatSocketEvents.JOIN_GROUP)
  async onJoinGroup(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() payload: JoinGroupPayload,
  ): Promise<{ ok: boolean }> {
    return this.groupMessage.joinGroup(this.server, socket, payload);
  }

  @SubscribeMessage(ChatSocketEvents.WATCH_PRESENCE)
  async onWatchPresence(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() payload: WatchPresencePayload | undefined,
  ): Promise<{ ok: boolean }> {
    return this.groupPresence.watchPresence(this.server, socket, payload);
  }

  @SubscribeMessage(ChatSocketEvents.UNWATCH_PRESENCE)
  async onUnwatchPresence(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() payload: WatchPresencePayload | undefined,
  ): Promise<void> {
    await this.groupPresence.unwatchPresence(socket, payload);
  }

  @SubscribeMessage(ChatSocketEvents.WATCH_GROUP_SUMMARIES)
  async onWatchGroupSummaries(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() payload: WatchGroupSummariesPayload | undefined,
  ): Promise<{ ok: boolean }> {
    return this.groupSummary.watchGroupSummaries(socket, payload);
  }

  @SubscribeMessage(ChatSocketEvents.UNWATCH_GROUP_SUMMARIES)
  async onUnwatchGroupSummaries(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() payload: WatchGroupSummariesPayload | undefined,
  ): Promise<void> {
    await this.groupSummary.unwatchGroupSummaries(socket, payload);
  }

  @SubscribeMessage(ChatSocketEvents.MARK_GROUP_READ)
  async onMarkGroupRead(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() payload: MarkGroupReadPayload,
  ): Promise<{ ok: boolean }> {
    return this.groupSummary.markGroupRead(socket, payload);
  }

  @SubscribeMessage(ChatSocketEvents.LEAVE_GROUP)
  async onLeaveGroup(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() payload: JoinGroupPayload,
  ): Promise<void> {
    await this.groupMessage.leaveGroup(this.server, socket, payload);
  }

  @SubscribeMessage(ChatSocketEvents.SEND_MESSAGE)
  async onSendMessage(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() payload: SendMessagePayload,
  ): Promise<void> {
    await this.groupMessage.sendGroupMessage(this.server, socket, payload);
  }

  @SubscribeMessage(ChatSocketEvents.JOIN_DM)
  async onJoinDm(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() payload: JoinDmPayload,
  ): Promise<{ ok: boolean }> {
    return this.dmMessage.joinDm(socket, payload);
  }

  @SubscribeMessage(ChatSocketEvents.LEAVE_DM)
  async onLeaveDm(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() payload: JoinDmPayload,
  ): Promise<void> {
    await this.dmMessage.leaveDm(socket, payload);
  }

  @SubscribeMessage(ChatSocketEvents.SEND_DM)
  async onSendDm(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() payload: SendDmPayload,
  ): Promise<void> {
    await this.dmMessage.sendDm(this.server, socket, payload);
  }

  @SubscribeMessage(ChatSocketEvents.WATCH_DM_PRESENCE)
  async onWatchDmPresence(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() payload: WatchDmPresencePayload | undefined,
  ): Promise<{ ok: boolean }> {
    return this.dmPresence.watchDmPresence(this.server, socket, payload);
  }

  @SubscribeMessage(ChatSocketEvents.UNWATCH_DM_PRESENCE)
  async onUnwatchDmPresence(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() payload: WatchDmPresencePayload | undefined,
  ): Promise<void> {
    await this.dmPresence.unwatchDmPresence(socket, payload);
  }

  @SubscribeMessage(ChatSocketEvents.WATCH_DM_INBOX)
  async onWatchDmInbox(
    @ConnectedSocket() socket: AuthedSocket,
  ): Promise<{ ok: boolean }> {
    return this.dmInbox.watchDmInbox(socket);
  }

  @SubscribeMessage(ChatSocketEvents.UNWATCH_DM_INBOX)
  async onUnwatchDmInbox(
    @ConnectedSocket() socket: AuthedSocket,
  ): Promise<void> {
    await this.dmInbox.unwatchDmInbox(socket);
  }

  @SubscribeMessage(ChatSocketEvents.MARK_DM_READ)
  async onMarkDmRead(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() payload: MarkDmReadPayload,
  ): Promise<{ ok: boolean }> {
    return this.dmMessage.markDmRead(this.server, socket, payload);
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
