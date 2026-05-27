import { DirectMessagePayload } from '@/modules/direct-messages/application/use-cases/send-direct-message/send-direct-message.dto';
import { RealtimeEventsService } from '@/modules/realtime-events/realtime-events.service';
import { ChatGateway } from '../presentation/chat.gateway';
import { DirectMessageRealtimeEventHandler } from './direct-message-realtime-event.handler';

describe('DirectMessageRealtimeEventHandler', () => {
  let realtimeEvents: RealtimeEventsService;
  let chatGateway: jest.Mocked<ChatGateway>;
  let handler: DirectMessageRealtimeEventHandler;

  beforeEach(() => {
    realtimeEvents = new RealtimeEventsService();
    chatGateway = {
      emitDmRequestAccepted: jest.fn(),
      emitDmSummary: jest.fn(),
      emitDmReadSideEffects: jest.fn(),
    } as unknown as jest.Mocked<ChatGateway>;
    handler = new DirectMessageRealtimeEventHandler(
      realtimeEvents,
      chatGateway,
    );
    handler.onModuleInit();
  });

  afterEach(() => {
    handler.onModuleDestroy();
  });

  it('routes accepted request events to the chat gateway', () => {
    const payload = {
      id: 'dm-1',
      senderId: 'sender-1',
      recipientId: 'recipient-1',
      content: 'hello',
      createdAt: '2026-05-26T10:00:00.000Z',
      senderName: 'Alice',
      senderAvatarUrl: null,
    } as DirectMessagePayload;

    realtimeEvents.emit({
      type: 'dm_request_accepted',
      senderId: 'sender-1',
      payload,
    });

    expect(chatGateway.emitDmRequestAccepted).toHaveBeenCalledWith(
      'sender-1',
      payload,
    );
  });

  it('routes summary request events to the chat gateway', () => {
    realtimeEvents.emit({
      type: 'dm_summary_requested',
      userId: 'user-1',
      peerId: 'user-2',
    });

    expect(chatGateway.emitDmSummary).toHaveBeenCalledWith('user-1', 'user-2');
  });

  it('routes read events to the chat gateway', () => {
    const lastReadAt = new Date('2026-05-26T10:00:00Z');

    realtimeEvents.emit({
      type: 'dm_read',
      readerId: 'user-1',
      peerId: 'user-2',
      lastReadAt,
    });

    expect(chatGateway.emitDmReadSideEffects).toHaveBeenCalledWith(
      'user-1',
      'user-2',
      lastReadAt,
    );
  });

  it('unsubscribes on module destroy', () => {
    handler.onModuleDestroy();

    realtimeEvents.emit({
      type: 'dm_summary_requested',
      userId: 'user-1',
      peerId: 'user-2',
    });

    expect(chatGateway.emitDmSummary).not.toHaveBeenCalled();
  });
});
