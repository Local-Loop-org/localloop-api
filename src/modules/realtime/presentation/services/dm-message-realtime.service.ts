import { Injectable, Logger } from '@nestjs/common';
import {
  ChatSocketEvents,
  DirectMessageDeleted,
  DmReadReceipt,
} from '@localloop/shared-types';
import { Namespace } from 'socket.io';

import { DirectMessagePayload } from '@/modules/direct-messages/application/use-cases/send-direct-message/send-direct-message.dto';
import { SendDirectMessageUseCase } from '@/modules/direct-messages/application/use-cases/send-direct-message/send-direct-message.use-case';
import { MarkDmReadUseCase } from '@/modules/direct-messages/application/use-cases/mark-dm-read/mark-dm-read.use-case';
import { ClearChatNotificationDigestUseCase } from '@/modules/notifications/application/use-cases/clear-chat-notification-digest/clear-chat-notification-digest.use-case';
import { SendDirectMessagePushNotificationsUseCase } from '@/modules/notifications/application/use-cases/send-direct-message-push-notifications/send-direct-message-push-notifications.use-case';
import { dmConversationKey, dmRoom } from '@/modules/realtime/realtime.rooms';
import {
  AuthedSocket,
  JoinDmPayload,
  MarkDmReadPayload,
  SendDmPayload,
} from '@/modules/realtime/realtime.types';
import { DmInboxRealtimeService } from './dm-inbox-realtime.service';

@Injectable()
export class DmMessageRealtimeService {
  private readonly logger = new Logger(DmMessageRealtimeService.name);

  constructor(
    private readonly sendDirectMessage: SendDirectMessageUseCase,
    private readonly sendDirectMessagePush: SendDirectMessagePushNotificationsUseCase,
    private readonly clearChatNotificationDigest: ClearChatNotificationDigestUseCase,
    private readonly markDmReadUseCase: MarkDmReadUseCase,
    private readonly dmInbox: DmInboxRealtimeService,
  ) {}

  async joinDm(
    socket: AuthedSocket,
    payload: JoinDmPayload,
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
    await this.clearPushDigest(callerId, dmConversationKey(payload.userId));
    return { ok: true };
  }

  async leaveDm(socket: AuthedSocket, payload: JoinDmPayload): Promise<void> {
    if (
      !payload ||
      typeof payload.userId !== 'string' ||
      payload.userId.length === 0
    ) {
      return;
    }
    await socket.leave(dmRoom(socket.data.user.id, payload.userId));
  }

  async sendDm(
    server: Namespace,
    socket: AuthedSocket,
    payload: SendDmPayload,
  ): Promise<void> {
    try {
      const callerId = socket.data.user.id;
      const result = await this.sendDirectMessage.execute(
        callerId,
        payload.recipientId,
        { content: payload.content ?? null },
      );
      if (result.type === 'message') {
        server
          .to(dmRoom(callerId, payload.recipientId))
          .emit(ChatSocketEvents.NEW_DIRECT_MESSAGE, result);
        void this.dmInbox
          .emitDmSummary(server, callerId, payload.recipientId)
          .catch((err) =>
            this.logger.warn(
              `DM summary fan-out failed for sender ${callerId}: ${(err as Error).message}`,
            ),
          );
        void this.dmInbox
          .emitDmSummary(server, payload.recipientId, callerId)
          .catch((err) =>
            this.logger.warn(
              `DM summary fan-out failed for recipient ${payload.recipientId}: ${(err as Error).message}`,
            ),
          );
        void this.notifyDirectMessage(server, {
          callerId,
          recipientId: payload.recipientId,
          message: result,
        }).catch(() => {
          this.logger.warn(
            `DM push fan-out failed for direct message ${result.id}`,
          );
        });
      } else {
        socket.emit(ChatSocketEvents.DM_REQUEST_SENT, {
          requestId: result.requestId,
        });
      }
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

  async markDmRead(
    server: Namespace,
    socket: AuthedSocket,
    payload: MarkDmReadPayload,
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
    try {
      const result = await this.markDmReadUseCase.execute(
        callerId,
        payload.peerId,
      );
      await this.emitDmReadSideEffects(
        server,
        callerId,
        payload.peerId,
        result.lastReadAt,
      );
      return { ok: true };
    } catch (err) {
      const e = err as {
        response?: { error?: string; message?: string };
        message?: string;
      };
      socket.emit(ChatSocketEvents.ERROR, {
        code: e.response?.error ?? 'MARK_DM_READ_FAILED',
        message: e.response?.message ?? e.message ?? 'Failed to mark DM read',
      });
      return { ok: false };
    }
  }

  async emitDmReadSideEffects(
    server: Namespace,
    readerId: string,
    peerId: string,
    lastReadAt: Date,
  ): Promise<void> {
    await this.dmInbox.emitDmSummary(server, readerId, peerId);
    const payload: DmReadReceipt = {
      readerId,
      peerId,
      lastReadAt: lastReadAt.toISOString(),
    };
    server
      .to(dmRoom(readerId, peerId))
      .emit(ChatSocketEvents.DM_READ_RECEIPT, payload);
    await this.clearPushDigest(readerId, dmConversationKey(peerId));
  }

  emitDirectMessageDeleted(
    server: Namespace,
    payload: DirectMessageDeleted,
  ): void {
    server
      .to(dmRoom(payload.senderId, payload.recipientId))
      .emit(ChatSocketEvents.DIRECT_MESSAGE_DELETED, payload);
  }

  private async notifyDirectMessage(
    server: Namespace,
    args: {
      callerId: string;
      recipientId: string;
      message: DirectMessagePayload;
    },
  ): Promise<void> {
    const sockets = await server
      .in(dmRoom(args.callerId, args.recipientId))
      .fetchSockets();
    const onlineUserIds = sockets
      .map((socket) => (socket.data as { user?: { id?: string } })?.user?.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    if (onlineUserIds.includes(args.recipientId)) return;

    await this.sendDirectMessagePush.execute({
      senderId: args.callerId,
      senderName: args.message.senderName,
      senderAvatarUrl: args.message.senderAvatarUrl,
      recipientId: args.recipientId,
      messageId: args.message.id,
      content: args.message.content,
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
