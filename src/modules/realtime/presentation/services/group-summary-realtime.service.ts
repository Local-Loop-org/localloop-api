import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ChatSocketEvents,
  GroupSummaryUpdate,
  MemberStatus,
} from '@localloop/shared-types';
import { Namespace } from 'socket.io';

import {
  GROUP_REPOSITORY,
  IGroupRepository,
  MyGroupSummary,
} from '@/modules/groups/domain/repositories/i-group.repository';
import { ClearChatNotificationDigestUseCase } from '@/modules/notifications/application/use-cases/clear-chat-notification-digest/clear-chat-notification-digest.use-case';
import {
  groupConversationKey,
  groupSummaryRoom,
} from '@/modules/realtime/realtime.rooms';
import {
  AuthedSocket,
  MarkGroupReadPayload,
  WatchGroupSummariesPayload,
} from '@/modules/realtime/realtime.types';
import { GroupPresenceRealtimeService } from './group-presence-realtime.service';

@Injectable()
export class GroupSummaryRealtimeService {
  private readonly logger = new Logger(GroupSummaryRealtimeService.name);

  constructor(
    @Inject(GROUP_REPOSITORY) private readonly groupRepo: IGroupRepository,
    private readonly groupPresence: GroupPresenceRealtimeService,
    private readonly clearChatNotificationDigest: ClearChatNotificationDigestUseCase,
  ) {}

  async watchGroupSummaries(
    socket: AuthedSocket,
    payload: WatchGroupSummariesPayload | undefined,
  ): Promise<{ ok: boolean }> {
    const userId = socket.data.user.id;
    const groupIds = this.groupPresence.normalizeGroupIds(payload);

    for (const groupId of groupIds) {
      const allowed = await this.canWatchGroupSummary(groupId, userId);
      if (!allowed) continue;
      await socket.join(groupSummaryRoom(groupId));
      await this.emitGroupSummaryToSocket(socket, groupId);
    }

    return { ok: true };
  }

  async unwatchGroupSummaries(
    socket: AuthedSocket,
    payload: WatchGroupSummariesPayload | undefined,
  ): Promise<void> {
    const groupIds = this.groupPresence.normalizeGroupIds(payload);
    await Promise.all(
      groupIds.map((groupId) => socket.leave(groupSummaryRoom(groupId))),
    );
  }

  async markGroupRead(
    socket: AuthedSocket,
    payload: MarkGroupReadPayload,
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
    await this.clearPushDigest(
      socket.data.user.id,
      groupConversationKey(payload.groupId),
    );
    return { ok: true };
  }

  async emitGroupSummary(server: Namespace, groupId: string): Promise<void> {
    const sockets = await server.in(groupSummaryRoom(groupId)).fetchSockets();
    const payloads = new Map<string, GroupSummaryUpdate | null>();

    for (const socket of sockets) {
      const summarySocket = socket as unknown as {
        data?: { user?: { id: string } };
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

  async emitGroupSummaryToSocket(
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

  toGroupSummaryUpdate(summary: MyGroupSummary): GroupSummaryUpdate {
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

  private async canWatchGroupSummary(
    groupId: string,
    userId: string,
  ): Promise<boolean> {
    const member = await this.groupRepo.findMember(groupId, userId);
    return member?.status === MemberStatus.ACTIVE;
  }

  private async clearPushDigest(
    recipientUserId: string,
    conversationKey: `group:${string}` | `dm:${string}`,
  ): Promise<void> {
    try {
      await this.clearChatNotificationDigest.execute({
        recipientUserId,
        conversationKey,
      });
    } catch (err) {
      this.logger.warn(
        `Chat notification digest cleanup failed: ${(err as Error).message}`,
      );
    }
  }
}
