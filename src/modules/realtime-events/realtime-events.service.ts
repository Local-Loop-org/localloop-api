import { Injectable, Logger } from '@nestjs/common';

import {
  RealtimeEvent,
  RealtimeEventHandler,
} from './realtime-event.type';

@Injectable()
export class RealtimeEventsService {
  private readonly logger = new Logger(RealtimeEventsService.name);
  private readonly handlers = new Set<RealtimeEventHandler>();

  emit(event: RealtimeEvent): void {
    for (const handler of this.handlers) {
      try {
        void Promise.resolve(handler(event)).catch((err: unknown) => {
          this.logHandlerError(event.type, err);
        });
      } catch (err) {
        this.logHandlerError(event.type, err);
      }
    }
  }

  on(handler: RealtimeEventHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  private logHandlerError(type: RealtimeEvent['type'], err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.warn(`Realtime event handler failed for ${type}: ${message}`);
  }
}
