import { BadRequestException, NotFoundException } from '@nestjs/common';

import {
  DirectMessageRow,
  IDirectMessageRepository,
} from '@/modules/direct-messages/domain/repositories/i-direct-message.repository';
import { IUserRepository } from '@/modules/auth/domain/repositories/i-user.repository';
import {
  buildUser,
  buildUserRepoMock,
} from '@/modules/direct-messages/test/user-repo.mock';
import { buildDirectMessageRepoMock } from '@/modules/direct-messages/test/direct-message-repo.mock';
import { GetDirectMessageHistoryUseCase } from './get-direct-message-history.use-case';

describe('GetDirectMessageHistoryUseCase', () => {
  let useCase: GetDirectMessageHistoryUseCase;
  let directMessageRepo: jest.Mocked<IDirectMessageRepository>;
  let userRepo: jest.Mocked<IUserRepository>;

  const CALLER = 'user-caller';
  const OTHER = 'user-other';

  const buildRow = (
    id: string,
    at: string,
    senderId = CALLER,
  ): DirectMessageRow => ({
    id,
    senderId,
    senderName: senderId === CALLER ? 'Alice' : 'Bob',
    senderAvatarUrl: null,
    recipientId: senderId === CALLER ? OTHER : CALLER,
    content: 'hello',
    mediaUrl: null,
    mediaType: null,
    createdAt: new Date(at),
  });

  beforeEach(() => {
    directMessageRepo = buildDirectMessageRepoMock();
    userRepo = buildUserRepoMock();
    useCase = new GetDirectMessageHistoryUseCase(directMessageRepo, userRepo);
  });

  it('returns paginated history with serialized timestamps', async () => {
    userRepo.findById.mockResolvedValue(buildUser({ id: OTHER }));
    directMessageRepo.listConversation.mockResolvedValue({
      rows: [
        buildRow('dm-2', '2026-05-16T10:01:00Z', OTHER),
        buildRow('dm-1', '2026-05-16T10:00:00Z', CALLER),
      ],
      nextCursor: '2026-05-16T09:59:00.000Z',
    });

    const result = await useCase.execute(CALLER, OTHER, 20, 'cursor');

    expect(directMessageRepo.listConversation).toHaveBeenCalledWith(
      CALLER,
      OTHER,
      20,
      'cursor',
    );
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toEqual({
      id: 'dm-2',
      senderId: OTHER,
      senderName: 'Bob',
      senderAvatarUrl: null,
      recipientId: CALLER,
      content: 'hello',
      mediaUrl: null,
      mediaType: null,
      createdAt: '2026-05-16T10:01:00.000Z',
    });
    expect(result.next_cursor).toBe('2026-05-16T09:59:00.000Z');
  });

  it('applies default limit of 50 when unspecified', async () => {
    userRepo.findById.mockResolvedValue(buildUser({ id: OTHER }));
    directMessageRepo.listConversation.mockResolvedValue({
      rows: [],
      nextCursor: null,
    });

    await useCase.execute(CALLER, OTHER);

    expect(directMessageRepo.listConversation).toHaveBeenCalledWith(
      CALLER,
      OTHER,
      50,
      undefined,
    );
  });

  it('rejects reading DMs with self', async () => {
    await expect(useCase.execute(CALLER, CALLER)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(userRepo.findById).not.toHaveBeenCalled();
  });

  it('rejects when the other user does not exist', async () => {
    userRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute(CALLER, OTHER)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(directMessageRepo.listConversation).not.toHaveBeenCalled();
  });

  it('returns history when the other user is inactive (placeholder applied at repo layer)', async () => {
    userRepo.findById.mockResolvedValue(
      buildUser({ id: OTHER, isActive: false }),
    );
    directMessageRepo.listConversation.mockResolvedValue({
      rows: [buildRow('dm-1', '2026-05-16T10:00:00Z', OTHER)],
      nextCursor: null,
    });

    const result = await useCase.execute(CALLER, OTHER);

    expect(directMessageRepo.listConversation).toHaveBeenCalledWith(
      CALLER,
      OTHER,
      50,
      undefined,
    );
    expect(result.data).toHaveLength(1);
  });
});
