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
import { MemberStatus, PresenceUpdate } from '@localloop/shared-types';

import { User } from '@/modules/auth/domain/entities/user.entity';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '@/modules/auth/domain/repositories/i-user.repository';
import {
  GROUP_REPOSITORY,
  IGroupRepository,
} from '@/modules/groups/domain/repositories/i-group.repository';
import { SendMessageUseCase } from '../application/use-cases/send-message/send-message.use-case';

interface JoinGroupPayload {
  groupId: string;
}

interface SendMessagePayload {
  groupId: string;
  content: string | null;
  storageKey: string | null;
  mediaType: 'image' | 'video' | null;
}

interface AuthedSocket extends Socket {
  data: { user: User };
}

const GROUP_ROOM_PREFIX = 'group:';
const groupRoom = (groupId: string) => `${GROUP_ROOM_PREFIX}${groupId}`;
const groupIdFromRoom = (room: string) =>
  room.slice(GROUP_ROOM_PREFIX.length);

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
    this.server.to(room).emit('presence_update', payload);
  }

  @SubscribeMessage('join_group')
  async onJoinGroup(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() payload: JoinGroupPayload,
  ): Promise<{ ok: boolean }> {
    const userId = socket.data.user.id;
    const member = await this.groupRepo.findMember(payload.groupId, userId);
    if (!member || member.status !== MemberStatus.ACTIVE) {
      socket.emit('error', {
        code: 'FORBIDDEN',
        message: 'Not an active member of this group',
      });
      return { ok: false };
    }
    await socket.join(groupRoom(payload.groupId));
    await this.emitPresence(payload.groupId);
    return { ok: true };
  }

  @SubscribeMessage('leave_group')
  async onLeaveGroup(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() payload: JoinGroupPayload,
  ): Promise<void> {
    await socket.leave(groupRoom(payload.groupId));
    await this.emitPresence(payload.groupId);
  }

  @SubscribeMessage('send_message')
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
      this.server.to(groupRoom(payload.groupId)).emit('new_message', result);
    } catch (err) {
      const e = err as {
        response?: { error?: string; message?: string };
        message?: string;
      };
      socket.emit('error', {
        code: e.response?.error ?? 'SEND_FAILED',
        message: e.response?.message ?? e.message ?? 'Failed to send message',
      });
    }
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
