import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { DirectMessage } from '@/modules/direct-messages/domain/entities/direct-message.entity';
import { buildDirectMessageRepoMock } from '@/modules/direct-messages/test/direct-message-repo.mock';
import { EditDirectMessageUseCase } from './edit-direct-message.use-case';

describe('EditDirectMessageUseCase', () => {
  let useCase: EditDirectMessageUseCase;
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
    useCase = new EditDirectMessageUseCase(directMessageRepo);
  });

  it('updates content and sets editedAt when the caller is the sender', async () => {
    directMessageRepo.findById.mockResolvedValue(buildDm());

    const result = await useCase.execute('caller-1', 'dm-1', {
      content: 'edited content',
    });

    expect(directMessageRepo.markAsEdited).toHaveBeenCalledWith(
      'dm-1',
      'edited content',
      expect.any(Date),
    );
    expect(result).toEqual({
      id: 'dm-1',
      senderId: 'caller-1',
      recipientId: 'peer-1',
      content: 'edited content',
      editedAt: expect.any(Date),
      editedBy: 'caller-1',
    });
  });

  it('rejects when the caller is the recipient (not the sender)', async () => {
    directMessageRepo.findById.mockResolvedValue(
      buildDm({ senderId: 'peer-1' }),
    );

    await expect(
      useCase.execute('caller-1', 'dm-1', { content: 'edited' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(directMessageRepo.markAsEdited).not.toHaveBeenCalled();
  });

  it('throws 404 when the message does not exist', async () => {
    directMessageRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('caller-1', 'dm-1', { content: 'edited' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(directMessageRepo.markAsEdited).not.toHaveBeenCalled();
  });

  it('throws 404 when the message is already soft-deleted', async () => {
    directMessageRepo.findById.mockResolvedValue(buildDm({ isDeleted: true }));

    await expect(
      useCase.execute('caller-1', 'dm-1', { content: 'edited' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(directMessageRepo.markAsEdited).not.toHaveBeenCalled();
  });

  it('throws 400 EMPTY_MESSAGE when content is an empty string', async () => {
    directMessageRepo.findById.mockResolvedValue(buildDm());

    await expect(
      useCase.execute('caller-1', 'dm-1', { content: '' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(directMessageRepo.markAsEdited).not.toHaveBeenCalled();
  });

  it('throws 400 EMPTY_MESSAGE when content is whitespace-only', async () => {
    directMessageRepo.findById.mockResolvedValue(buildDm());

    await expect(
      useCase.execute('caller-1', 'dm-1', { content: '   \n\t  ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(directMessageRepo.markAsEdited).not.toHaveBeenCalled();
  });

  it('trims surrounding whitespace from content before persisting', async () => {
    directMessageRepo.findById.mockResolvedValue(buildDm());

    const result = await useCase.execute('caller-1', 'dm-1', {
      content: '  hello peer  ',
    });

    expect(directMessageRepo.markAsEdited).toHaveBeenCalledWith(
      'dm-1',
      'hello peer',
      expect.any(Date),
    );
    expect(result.content).toBe('hello peer');
  });
});
