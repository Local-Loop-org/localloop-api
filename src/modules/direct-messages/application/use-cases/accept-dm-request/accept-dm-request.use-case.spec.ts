import { NotFoundException } from '@nestjs/common';

import {
  DirectMessageRow,
  DmRequestRecord,
  IDirectMessageRepository,
} from '@/modules/direct-messages/domain/repositories/i-direct-message.repository';
import { buildDirectMessageRepoMock } from '@/modules/direct-messages/test/direct-message-repo.mock';
import { AcceptDmRequestUseCase } from './accept-dm-request.use-case';

describe('AcceptDmRequestUseCase', () => {
  let useCase: AcceptDmRequestUseCase;
  let directMessageRepo: jest.Mocked<IDirectMessageRepository>;

  const SENDER = 'user-sender';
  const RECIPIENT = 'user-recipient';
  const STRANGER = 'user-stranger';
  const REQUEST_ID = 'req-1';
  const REQUEST_CREATED_AT = new Date('2026-05-19T10:00:00Z');

  const buildRequest = (): DmRequestRecord => ({
    id: REQUEST_ID,
    senderId: SENDER,
    recipientId: RECIPIENT,
    content: 'hello',
    createdAt: REQUEST_CREATED_AT,
  });

  const buildRow = (): DirectMessageRow => ({
    id: 'dm-9',
    senderId: SENDER,
    senderName: 'Alice',
    senderAvatarUrl: null,
    recipientId: RECIPIENT,
    content: 'hello',
    mediaUrl: null,
    mediaType: null,
    isDeleted: false,
    editedAt: null,
    replyTo: null,
    createdAt: REQUEST_CREATED_AT,
  });

  beforeEach(() => {
    directMessageRepo = buildDirectMessageRepoMock();
    useCase = new AcceptDmRequestUseCase(directMessageRepo);
  });

  it('materializes the held message and returns the payload when caller is recipient', async () => {
    directMessageRepo.findRequestById.mockResolvedValue(buildRequest());
    directMessageRepo.acceptRequestAtomic.mockResolvedValue(buildRow());

    const result = await useCase.execute(RECIPIENT, REQUEST_ID);

    expect(directMessageRepo.acceptRequestAtomic).toHaveBeenCalledWith(
      REQUEST_ID,
    );
    expect(result).toEqual({
      id: 'dm-9',
      senderId: SENDER,
      senderName: 'Alice',
      senderAvatarUrl: null,
      recipientId: RECIPIENT,
      content: 'hello',
      mediaUrl: null,
      mediaType: null,
      isDeleted: false,
      editedAt: null,
      replyTo: null,
      createdAt: REQUEST_CREATED_AT.toISOString(),
    });
  });

  it('throws NotFoundException when the request does not exist', async () => {
    directMessageRepo.findRequestById.mockResolvedValue(null);

    await expect(useCase.execute(RECIPIENT, REQUEST_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(directMessageRepo.acceptRequestAtomic).not.toHaveBeenCalled();
  });

  it('throws NotFoundException (hides existence) when caller is not the recipient', async () => {
    directMessageRepo.findRequestById.mockResolvedValue(buildRequest());

    await expect(useCase.execute(STRANGER, REQUEST_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(directMessageRepo.acceptRequestAtomic).not.toHaveBeenCalled();
  });

  it('also returns 404 when the original sender tries to accept their own request', async () => {
    directMessageRepo.findRequestById.mockResolvedValue(buildRequest());

    await expect(useCase.execute(SENDER, REQUEST_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(directMessageRepo.acceptRequestAtomic).not.toHaveBeenCalled();
  });

  it('bubbles a NotFoundException thrown by the atomic call (concurrent accept already finished)', async () => {
    directMessageRepo.findRequestById.mockResolvedValue(buildRequest());
    directMessageRepo.acceptRequestAtomic.mockRejectedValue(
      new NotFoundException({
        error: 'DM_REQUEST_NOT_FOUND',
        message: 'DM request not found',
      }),
    );

    await expect(useCase.execute(RECIPIENT, REQUEST_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
