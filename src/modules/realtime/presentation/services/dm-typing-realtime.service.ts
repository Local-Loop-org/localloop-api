import { Injectable } from '@nestjs/common';
import { ChatSocketEvents, type DmTypingUpdate } from '@localloop/shared-types';
import { Namespace } from 'socket.io';

import { dmRoom } from '@/modules/realtime/realtime.rooms';
import {
  AuthedSocket,
  DmTypingPayload,
} from '@/modules/realtime/realtime.types';

/**
 * Relays an ephemeral "peer is typing" hint to the other side of a DM thread.
 *
 * Unlike presence, typing needs no watch room and no persistence: both
 * participants already share the sorted `dmRoom(a, b)` via `join_dm` whenever
 * the conversation is open, so we broadcast straight to that room — exactly how
 * `send_dm` routes. The caller receives its own echo (it is in the room), but
 * the mobile hook filters it out by `peerId`, so no self-typing bubble appears.
 */
@Injectable()
export class DmTypingRealtimeService {
  emitDmTyping(
    server: Namespace,
    socket: AuthedSocket,
    payload: DmTypingPayload | undefined,
  ): void {
    const callerId = socket.data.user.id;
    if (
      !payload ||
      typeof payload.recipientId !== 'string' ||
      payload.recipientId.length === 0 ||
      payload.recipientId === callerId
    ) {
      socket.emit(ChatSocketEvents.ERROR, {
        code: 'BAD_REQUEST',
        message: 'Invalid DM typing target',
      });
      return;
    }

    const update: DmTypingUpdate = {
      peerId: callerId,
      isTyping: payload.isTyping === true,
    };
    server
      .to(dmRoom(callerId, payload.recipientId))
      .emit(ChatSocketEvents.DM_TYPING_UPDATE, update);
  }
}
