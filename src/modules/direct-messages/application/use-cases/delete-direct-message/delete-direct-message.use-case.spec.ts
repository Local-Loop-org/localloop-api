import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { DirectMessage } from '@/modules/direct-messages/domain/entities/direct-message.entity';
import { buildDirectMessageRepoMock } from '@/modules/direct-messages/test/direct-message-repo.mock';
import { DeleteDirectMessageUseCase } from './delete-direct-message.use-case';

describe('DeleteDirectMessageUseCase', () => {
  let useCase: DeleteDirectMessageUseCase;
  let directMessageRepo: ReturnType<typeof buildDirectMessageRepoMock>;

  const buildDm = (
    overrides: Partial<{ senderId: string; isDeleted: boolean }> = {},
  ): DirectMessage =>
    new DirectMessage({
      id: 'dm-1',
      senderId: overrides.senderId ?? 'caller-1',
      recipientId: 'peer-1',
      content: 'hello',
      mediaUrl: null,
      mediaType: null,
      isDeleted: overrides.isDeleted ?? false,
      replyToMessageId: null,
      editedAt: null,
      createdAt: new Date('2026-04-24T10:00:00Z'),
    });

  beforeEach(() => {
    directMessageRepo = buildDirectMessageRepoMock();
    useCase = new DeleteDirectMessageUseCase(directMessageRepo);
  });

  it('soft-deletes when the caller is the sender', async () => {
    directMessageRepo.findById.mockResolvedValue(buildDm());

    const result = await useCase.execute('caller-1', 'dm-1');

    expect(directMessageRepo.markAsDeleted).toHaveBeenCalledWith('dm-1');
    expect(result).toEqual({
      id: 'dm-1',
      senderId: 'caller-1',
      recipientId: 'peer-1',
      deletedBy: 'caller-1',
    });
  });

  it('rejects when the caller is not the sender', async () => {
    directMessageRepo.findById.mockResolvedValue(
      buildDm({ senderId: 'someone-else' }),
    );

    await expect(useCase.execute('caller-1', 'dm-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(directMessageRepo.markAsDeleted).not.toHaveBeenCalled();
  });

  it('throws 404 when the message does not exist', async () => {
    directMessageRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('caller-1', 'dm-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(directMessageRepo.markAsDeleted).not.toHaveBeenCalled();
  });

  it('throws 404 when the message is already soft-deleted', async () => {
    directMessageRepo.findById.mockResolvedValue(buildDm({ isDeleted: true }));

    await expect(useCase.execute('caller-1', 'dm-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(directMessageRepo.markAsDeleted).not.toHaveBeenCalled();
  });
});
