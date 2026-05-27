import { Inject, Injectable } from '@nestjs/common';
import {
  ChatSocketEvents,
  type DmPresenceUpdate,
} from '@localloop/shared-types';
import { Namespace } from 'socket.io';

import { User } from '@/modules/auth/domain/entities/user.entity';
import {
  GROUP_REPOSITORY,
  IGroupRepository,
} from '@/modules/groups/domain/repositories/i-group.repository';
import {
  DIRECT_MESSAGE_REPOSITORY,
  IDirectMessageRepository,
} from '@/modules/direct-messages/domain/repositories/i-direct-message.repository';
import { dmPresenceRoom } from '@/modules/realtime/realtime.rooms';
import {
  AuthedSocket,
  WatchDmPresencePayload,
} from '@/modules/realtime/realtime.types';

@Injectable()
export class DmPresenceRealtimeService {
  constructor(
    @Inject(DIRECT_MESSAGE_REPOSITORY)
    private readonly directMessageRepo: IDirectMessageRepository,
    @Inject(GROUP_REPOSITORY) private readonly groupRepo: IGroupRepository,
  ) {}

  async emitDmPresenceForUser(
    server: Namespace,
    userId: string,
  ): Promise<void> {
    const payload: DmPresenceUpdate = {
      peerId: userId,
      online: await this.isUserOnline(server, userId),
    };
    server
      .to(dmPresenceRoom(userId))
      .emit(ChatSocketEvents.DM_PRESENCE_UPDATE, payload);
  }

  async watchDmPresence(
    server: Namespace,
    socket: AuthedSocket,
    payload: WatchDmPresencePayload | undefined,
  ): Promise<{ ok: boolean }> {
    const callerId = socket.data.user.id;
    if (
      !payload ||
      typeof payload.peerId !== 'string' ||
      payload.peerId.length === 0 ||
      payload.peerId === callerId
    ) {
      socket.emit(ChatSocketEvents.ERROR, {
        code: 'BAD_REQUEST',
        message: 'Invalid DM peer',
      });
      return { ok: false };
    }

    const allowed = await this.canWatchDmPresence(callerId, payload.peerId);
    if (!allowed) {
      socket.emit(ChatSocketEvents.ERROR, {
        code: 'FORBIDDEN',
        message: 'Cannot watch DM presence for this peer',
      });
      return { ok: false };
    }

    await socket.join(dmPresenceRoom(payload.peerId));
    socket.emit(ChatSocketEvents.DM_PRESENCE_UPDATE, {
      peerId: payload.peerId,
      online: await this.isUserOnline(server, payload.peerId),
    } satisfies DmPresenceUpdate);
    return { ok: true };
  }

  async unwatchDmPresence(
    socket: AuthedSocket,
    payload: WatchDmPresencePayload | undefined,
  ): Promise<void> {
    if (
      !payload ||
      typeof payload.peerId !== 'string' ||
      payload.peerId.length === 0
    ) {
      return;
    }
    await socket.leave(dmPresenceRoom(payload.peerId));
  }

  private async canWatchDmPresence(
    userId: string,
    peerId: string,
  ): Promise<boolean> {
    const readState = await this.directMessageRepo.getConversationReadState(
      userId,
      peerId,
    );
    if (readState) return true;

    return this.groupRepo.hasSharedActiveGroup(userId, peerId);
  }

  private async isUserOnline(
    server: Namespace,
    userId: string,
  ): Promise<boolean> {
    const sockets = await server.fetchSockets();
    return sockets.some((socket) => {
      const data = (socket as unknown as { data?: { user?: User } }).data;
      return data?.user?.id === userId;
    });
  }
}
