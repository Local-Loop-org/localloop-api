import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { RealtimeEvent } from '@/modules/realtime-events/realtime-event.type';
import { RealtimeEventsService } from '@/modules/realtime-events/realtime-events.service';
import { ChatGateway } from './chat.gateway';

@Injectable()
export class DirectMessageRealtimeEventHandler
  implements OnModuleInit, OnModuleDestroy
{
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly realtimeEvents: RealtimeEventsService,
    private readonly chatGateway: ChatGateway,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.realtimeEvents.on((event) => this.handle(event));
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private async handle(event: RealtimeEvent): Promise<void> {
    switch (event.type) {
      case 'dm_request_accepted':
        await this.chatGateway.emitDmRequestAccepted(
          event.senderId,
          event.payload,
        );
        return;
      case 'dm_summary_requested':
        await this.chatGateway.emitDmSummary(event.userId, event.peerId);
        return;
      case 'dm_read':
        await this.chatGateway.emitDmReadSideEffects(
          event.readerId,
          event.peerId,
          event.lastReadAt,
        );
        return;
    }
  }
}
