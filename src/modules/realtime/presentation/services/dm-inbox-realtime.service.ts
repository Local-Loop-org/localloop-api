import { Inject, Injectable } from '@nestjs/common';
import { ChatSocketEvents, DmSummaryUpdate } from '@localloop/shared-types';
import { Namespace } from 'socket.io';

import { DirectMessagePayload } from '@/modules/direct-messages/application/use-cases/send-direct-message/send-direct-message.dto';
import {
  DIRECT_MESSAGE_REPOSITORY,
  DmSummary,
  IDirectMessageRepository,
} from '@/modules/direct-messages/domain/repositories/i-direct-message.repository';
import { dmInboxRoom } from '@/modules/realtime/realtime.rooms';
import { AuthedSocket } from '@/modules/realtime/realtime.types';

@Injectable()
export class DmInboxRealtimeService {
  constructor(
    @Inject(DIRECT_MESSAGE_REPOSITORY)
    private readonly directMessageRepo: IDirectMessageRepository,
  ) {}

  async watchDmInbox(socket: AuthedSocket): Promise<{ ok: boolean }> {
    await socket.join(dmInboxRoom(socket.data.user.id));
    return { ok: true };
  }

  async unwatchDmInbox(socket: AuthedSocket): Promise<void> {
    await socket.leave(dmInboxRoom(socket.data.user.id));
  }

  /**
   * Fan out `dm_request_accepted` to every connected socket of the original
   * sender via the `dm_inbox:user:{senderId}` room. Multi-device fan-out is
   * an implicit property of the room: every socket that has called
   * `watch_dm_inbox` is in it. Mobile MUST emit `watch_dm_inbox` on connect
   * (architecture.md, "Direct messages → WS contract"). Recipient learns of
   * the materialized message via the HTTP response, so no room broadcast for
   * them is needed.
   */
  emitDmRequestAccepted(
    server: Namespace,
    senderId: string,
    payload: DirectMessagePayload,
  ): void {
    server
      .to(dmInboxRoom(senderId))
      .emit(ChatSocketEvents.DM_REQUEST_ACCEPTED, payload);
  }

  /**
   * Emits `dm_summary_update` to `dm_inbox:user:{userId}`. Silent when there's
   * no message exchanged with the peer (returns null from the repo) so we
   * never push an empty/stale payload.
   */
  async emitDmSummary(
    server: Namespace,
    userId: string,
    peerId: string,
  ): Promise<void> {
    const summary = await this.directMessageRepo.getDmSummary(userId, peerId);
    if (!summary) return;
    server
      .to(dmInboxRoom(userId))
      .emit(
        ChatSocketEvents.DM_SUMMARY_UPDATE,
        this.toDmSummaryUpdate(summary),
      );
  }

  toDmSummaryUpdate(summary: DmSummary): DmSummaryUpdate {
    return {
      peerId: summary.peerId,
      lastActivityAt: summary.lastActivityAt.toISOString(),
      lastReadAt: summary.lastReadAt ? summary.lastReadAt.toISOString() : null,
      unreadCount: summary.unreadCount,
      archived: summary.archived,
      lastMessage: summary.lastMessage
        ? {
            content: summary.lastMessage.content,
            senderName: summary.lastMessage.senderName,
            createdAt: summary.lastMessage.createdAt.toISOString(),
          }
        : null,
    };
  }
}
