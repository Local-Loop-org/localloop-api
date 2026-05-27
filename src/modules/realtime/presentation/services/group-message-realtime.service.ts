import { Inject, Injectable, Logger } from '@nestjs/common';
import { ChatSocketEvents, MemberStatus } from '@localloop/shared-types';
import { Namespace } from 'socket.io';

import {
  GROUP_REPOSITORY,
  IGroupRepository,
} from '@/modules/groups/domain/repositories/i-group.repository';
import { SendMessageResponseDto } from '@/modules/messages/application/use-cases/send-message/send-message.dto';
import { SendMessageUseCase } from '@/modules/messages/application/use-cases/send-message/send-message.use-case';
import { ClearChatNotificationDigestUseCase } from '@/modules/notifications/application/use-cases/clear-chat-notification-digest/clear-chat-notification-digest.use-case';
import { SendGroupMessagePushNotificationsUseCase } from '@/modules/notifications/application/use-cases/send-group-message-push-notifications/send-group-message-push-notifications.use-case';
import {
  groupConversationKey,
  groupRoom,
} from '@/modules/realtime/realtime.rooms';
import {
  AuthedSocket,
  JoinGroupPayload,
  SendMessagePayload,
} from '@/modules/realtime/realtime.types';
import { GroupPresenceRealtimeService } from './group-presence-realtime.service';
import { GroupSummaryRealtimeService } from './group-summary-realtime.service';

@Injectable()
export class GroupMessageRealtimeService {
  private readonly logger = new Logger(GroupMessageRealtimeService.name);

  constructor(
    @Inject(GROUP_REPOSITORY) private readonly groupRepo: IGroupRepository,
    private readonly sendMessage: SendMessageUseCase,
    private readonly sendGroupMessagePush: SendGroupMessagePushNotificationsUseCase,
    private readonly clearChatNotificationDigest: ClearChatNotificationDigestUseCase,
    private readonly groupPresence: GroupPresenceRealtimeService,
    private readonly groupSummary: GroupSummaryRealtimeService,
  ) {}

  async joinGroup(
    server: Namespace,
    socket: AuthedSocket,
    payload: JoinGroupPayload,
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
    await this.groupPresence.emitPresence(server, payload.groupId);
    await this.clearPushDigest(userId, groupConversationKey(payload.groupId));
    return { ok: true };
  }

  async leaveGroup(
    server: Namespace,
    socket: AuthedSocket,
    payload: JoinGroupPayload,
  ): Promise<void> {
    await socket.leave(groupRoom(payload.groupId));
    await this.groupPresence.emitPresence(server, payload.groupId);
  }

  async sendGroupMessage(
    server: Namespace,
    socket: AuthedSocket,
    payload: SendMessagePayload,
  ): Promise<void> {
    try {
      const result = await this.sendMessage.execute(
        socket.data.user.id,
        payload.groupId,
        { content: payload.content ?? null },
      );
      server
        .to(groupRoom(payload.groupId))
        .emit(ChatSocketEvents.NEW_MESSAGE, result);
      void this.groupSummary
        .emitGroupSummary(server, result.groupId)
        .catch(() => {
          this.logger.warn(
            `Group summary fan-out failed for message ${result.id}`,
          );
        });
      void this.notifyGroupMessage(server, result).catch(() => {
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

  private async notifyGroupMessage(
    server: Namespace,
    message: SendMessageResponseDto,
  ): Promise<void> {
    const sockets = await server.in(groupRoom(message.groupId)).fetchSockets();
    const activeUserIds = sockets
      .map((socket) => (socket.data as { user?: { id?: string } })?.user?.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    await this.sendGroupMessagePush.execute({
      groupId: message.groupId,
      messageId: message.id,
      senderId: message.senderId,
      senderName: message.senderName,
      senderAvatarUrl: message.senderAvatarUrl,
      content: message.content,
      excludedUserIds: activeUserIds,
    });
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
