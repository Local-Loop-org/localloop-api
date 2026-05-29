import { RequestMethod } from '@nestjs/common';
import {
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';

import { User } from '@/modules/auth/domain/entities/user.entity';
import { RealtimeEventsService } from '@/modules/realtime-events/realtime-events.service';
import { MarkDmReadUseCase } from '../application/use-cases/mark-dm-read/mark-dm-read.use-case';
import { DirectMessagesController } from './direct-messages.controller';

describe('DirectMessagesController', () => {
  let controller: DirectMessagesController;
  let acceptDmRequest: { execute: jest.Mock };
  let archiveDmConversation: { execute: jest.Mock };
  let unarchiveDmConversation: { execute: jest.Mock };
  let markDmRead: jest.Mocked<MarkDmReadUseCase>;
  let realtimeEvents: jest.Mocked<Pick<RealtimeEventsService, 'emit'>>;

  beforeEach(() => {
    acceptDmRequest = {
      execute: jest.fn(),
    };
    archiveDmConversation = {
      execute: jest.fn(),
    };
    unarchiveDmConversation = {
      execute: jest.fn(),
    };
    markDmRead = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<MarkDmReadUseCase>;
    realtimeEvents = {
      emit: jest.fn(),
    };

    controller = new DirectMessagesController(
      { execute: jest.fn() } as never,
      { execute: jest.fn() } as never,
      { execute: jest.fn() } as never,
      { execute: jest.fn() } as never,
      acceptDmRequest as never,
      { execute: jest.fn() } as never,
      archiveDmConversation as never,
      unarchiveDmConversation as never,
      markDmRead,
      { execute: jest.fn() } as never,
      { execute: jest.fn() } as never,
      realtimeEvents as unknown as RealtimeEventsService,
    );
  });

  it('emits accepted request and summary events after accepting a DM request', async () => {
    const payload = {
      id: 'dm-1',
      senderId: 'sender-1',
      senderName: 'Alice',
      senderAvatarUrl: null,
      recipientId: 'recipient-1',
      content: 'hello',
      mediaUrl: null,
      mediaType: null,
      createdAt: '2026-05-19T10:00:00.000Z',
    };
    acceptDmRequest.execute.mockResolvedValue(payload);

    await expect(
      controller.acceptRequest(
        { user: { id: 'recipient-1' } as User },
        'request-1',
      ),
    ).resolves.toBe(payload);

    expect(realtimeEvents.emit).toHaveBeenCalledWith({
      type: 'dm_request_accepted',
      senderId: 'sender-1',
      payload,
    });
    expect(realtimeEvents.emit).toHaveBeenCalledWith({
      type: 'dm_summary_requested',
      userId: 'sender-1',
      peerId: 'recipient-1',
    });
    expect(realtimeEvents.emit).toHaveBeenCalledWith({
      type: 'dm_summary_requested',
      userId: 'recipient-1',
      peerId: 'sender-1',
    });
  });

  it('emits caller-scoped summary events after archive toggles', async () => {
    await controller.archive({ user: { id: 'user-1' } as User }, 'user-2');
    await controller.unarchive({ user: { id: 'user-1' } as User }, 'user-2');

    expect(archiveDmConversation.execute).toHaveBeenCalledWith(
      'user-1',
      'user-2',
    );
    expect(unarchiveDmConversation.execute).toHaveBeenCalledWith(
      'user-1',
      'user-2',
    );
    expect(realtimeEvents.emit).toHaveBeenNthCalledWith(1, {
      type: 'dm_summary_requested',
      userId: 'user-1',
      peerId: 'user-2',
    });
    expect(realtimeEvents.emit).toHaveBeenNthCalledWith(2, {
      type: 'dm_summary_requested',
      userId: 'user-1',
      peerId: 'user-2',
    });
  });

  it('maps POST /dm/:userId/read to mark-read side effects', async () => {
    const lastReadAt = new Date('2026-05-19T10:00:00Z');
    markDmRead.execute.mockResolvedValue({ lastReadAt });

    await expect(
      controller.markRead({ user: { id: 'user-1' } as User }, 'user-2'),
    ).resolves.toBeUndefined();

    expect(markDmRead.execute).toHaveBeenCalledWith('user-1', 'user-2');
    expect(realtimeEvents.emit).toHaveBeenCalledWith({
      type: 'dm_read',
      readerId: 'user-1',
      peerId: 'user-2',
      lastReadAt,
    });
  });

  it('does not emit read side effects when mark-read fails', async () => {
    markDmRead.execute.mockRejectedValue(new Error('write failed'));

    await expect(
      controller.markRead({ user: { id: 'user-1' } as User }, 'user-2'),
    ).rejects.toThrow('write failed');

    expect(realtimeEvents.emit).not.toHaveBeenCalled();
  });

  it('exposes mark-read as POST :userId/read with no response body', () => {
    const handler = DirectMessagesController.prototype.markRead;

    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(':userId/read');
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
      RequestMethod.POST,
    );
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(204);
  });
});
