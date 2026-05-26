import { RequestMethod } from '@nestjs/common';
import {
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';

import { User } from '@/modules/auth/domain/entities/user.entity';
import { ChatGateway } from '@/modules/messages/presentation/chat.gateway';
import { MarkDmReadUseCase } from '../application/use-cases/mark-dm-read/mark-dm-read.use-case';
import { DirectMessagesController } from './direct-messages.controller';

describe('DirectMessagesController', () => {
  let controller: DirectMessagesController;
  let markDmRead: jest.Mocked<MarkDmReadUseCase>;
  let chatGateway: jest.Mocked<ChatGateway>;

  beforeEach(() => {
    markDmRead = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<MarkDmReadUseCase>;
    chatGateway = {
      emitDmReadSideEffects: jest.fn(),
    } as unknown as jest.Mocked<ChatGateway>;

    controller = new DirectMessagesController(
      { execute: jest.fn() } as never,
      { execute: jest.fn() } as never,
      { execute: jest.fn() } as never,
      { execute: jest.fn() } as never,
      { execute: jest.fn() } as never,
      { execute: jest.fn() } as never,
      { execute: jest.fn() } as never,
      { execute: jest.fn() } as never,
      markDmRead,
      chatGateway,
    );
  });

  it('maps POST /dm/:userId/read to mark-read side effects', async () => {
    const lastReadAt = new Date('2026-05-19T10:00:00Z');
    markDmRead.execute.mockResolvedValue({ lastReadAt });

    await expect(
      controller.markRead({ user: { id: 'user-1' } as User }, 'user-2'),
    ).resolves.toBeUndefined();

    expect(markDmRead.execute).toHaveBeenCalledWith('user-1', 'user-2');
    expect(chatGateway.emitDmReadSideEffects).toHaveBeenCalledWith(
      'user-1',
      'user-2',
      lastReadAt,
    );
  });

  it('does not emit read side effects when mark-read fails', async () => {
    markDmRead.execute.mockRejectedValue(new Error('write failed'));

    await expect(
      controller.markRead({ user: { id: 'user-1' } as User }, 'user-2'),
    ).rejects.toThrow('write failed');

    expect(chatGateway.emitDmReadSideEffects).not.toHaveBeenCalled();
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
