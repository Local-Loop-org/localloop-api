import { DirectMessagePayload } from '@/modules/direct-messages/application/use-cases/send-direct-message/send-direct-message.dto';
import { RealtimeEventsService } from '@/modules/realtime-events/realtime-events.service';
import { ChatGateway } from './chat.gateway';
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
      emitMessageDeleted: jest.fn(),
      emitDirectMessageDeleted: jest.fn(),
      emitMessageEdited: jest.fn(),
      emitDirectMessageEdited: jest.fn(),
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
      mediaUrl: null,
      mediaType: null,
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

  it('routes group message_deleted events to the chat gateway', () => {
    realtimeEvents.emit({
      type: 'message_deleted',
      groupId: 'group-1',
      messageId: 'msg-1',
      deletedBy: 'user-1',
    });

    expect(chatGateway.emitMessageDeleted).toHaveBeenCalledWith({
      messageId: 'msg-1',
      groupId: 'group-1',
      deletedBy: 'user-1',
    });
  });

  it('routes direct_message_deleted events to the chat gateway', () => {
    realtimeEvents.emit({
      type: 'direct_message_deleted',
      senderId: 'user-1',
      recipientId: 'user-2',
      messageId: 'dm-1',
      deletedBy: 'user-1',
    });

    expect(chatGateway.emitDirectMessageDeleted).toHaveBeenCalledWith({
      messageId: 'dm-1',
      senderId: 'user-1',
      recipientId: 'user-2',
      deletedBy: 'user-1',
    });
  });

  it('routes group message_edited events to the chat gateway', () => {
    const editedAt = new Date('2026-05-29T10:00:00Z');

    realtimeEvents.emit({
      type: 'message_edited',
      groupId: 'group-1',
      messageId: 'msg-1',
      content: 'edited content',
      editedAt,
      editedBy: 'user-1',
    });

    expect(chatGateway.emitMessageEdited).toHaveBeenCalledWith({
      messageId: 'msg-1',
      groupId: 'group-1',
      content: 'edited content',
      editedAt,
      editedBy: 'user-1',
    });
  });

  it('routes direct_message_edited events to the chat gateway', () => {
    const editedAt = new Date('2026-05-29T10:00:00Z');

    realtimeEvents.emit({
      type: 'direct_message_edited',
      senderId: 'user-1',
      recipientId: 'user-2',
      messageId: 'dm-1',
      content: 'edited content',
      editedAt,
      editedBy: 'user-1',
    });

    expect(chatGateway.emitDirectMessageEdited).toHaveBeenCalledWith({
      messageId: 'dm-1',
      senderId: 'user-1',
      recipientId: 'user-2',
      content: 'edited content',
      editedAt,
      editedBy: 'user-1',
    });
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
