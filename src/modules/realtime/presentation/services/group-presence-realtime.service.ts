import { Inject, Injectable } from '@nestjs/common';
import {
  ChatSocketEvents,
  GroupPrivacy,
  MemberStatus,
} from '@localloop/shared-types';
import { Namespace } from 'socket.io';

import {
  GROUP_REPOSITORY,
  IGroupRepository,
} from '@/modules/groups/domain/repositories/i-group.repository';
import {
  GROUP_ROOM_PREFIX,
  MAX_WATCHED_GROUPS,
  groupIdFromRoom,
  groupRoom,
  presenceRoom,
} from '@/modules/realtime/realtime.rooms';
import {
  AuthedSocket,
  WatchPresencePayload,
} from '@/modules/realtime/realtime.types';

@Injectable()
export class GroupPresenceRealtimeService {
  constructor(
    @Inject(GROUP_REPOSITORY) private readonly groupRepo: IGroupRepository,
  ) {}

  handleDisconnecting(server: Namespace, socket: AuthedSocket): void {
    const groupRooms = [...socket.rooms].filter((room) =>
      room.startsWith(GROUP_ROOM_PREFIX),
    );
    if (groupRooms.length === 0) return;

    setImmediate(() => {
      for (const room of groupRooms) {
        void this.emitPresence(server, groupIdFromRoom(room));
      }
    });
  }

  async emitPresence(server: Namespace, groupId: string): Promise<void> {
    const room = groupRoom(groupId);
    const sockets = await server.in(room).fetchSockets();
    const payload = { groupId, count: sockets.length };
    server.to(room).emit(ChatSocketEvents.PRESENCE_UPDATE, payload);
    server
      .to(presenceRoom(groupId))
      .emit(ChatSocketEvents.PRESENCE_UPDATE, payload);
  }

  async watchPresence(
    server: Namespace,
    socket: AuthedSocket,
    payload: WatchPresencePayload | undefined,
  ): Promise<{ ok: boolean }> {
    const userId = socket.data.user.id;
    const groupIds = this.normalizeGroupIds(payload);

    for (const groupId of groupIds) {
      const allowed = await this.canWatchPresence(groupId, userId);
      if (!allowed) continue;
      await socket.join(presenceRoom(groupId));
      await this.emitPresence(server, groupId);
    }

    return { ok: true };
  }

  async unwatchPresence(
    socket: AuthedSocket,
    payload: WatchPresencePayload | undefined,
  ): Promise<void> {
    const groupIds = this.normalizeGroupIds(payload);
    await Promise.all(
      groupIds.map((groupId) => socket.leave(presenceRoom(groupId))),
    );
  }

  normalizeGroupIds(payload: { groupIds?: unknown } | undefined): string[] {
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
}
