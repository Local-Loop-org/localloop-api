import { NotFoundException } from '@nestjs/common';

import {
  DmRequestRecord,
  IDirectMessageRepository,
} from '@/modules/direct-messages/domain/repositories/i-direct-message.repository';
import { buildDirectMessageRepoMock } from '@/modules/direct-messages/test/direct-message-repo.mock';
import { DeclineDmRequestUseCase } from './decline-dm-request.use-case';

describe('DeclineDmRequestUseCase', () => {
  let useCase: DeclineDmRequestUseCase;
  let directMessageRepo: jest.Mocked<IDirectMessageRepository>;

  const SENDER = 'user-sender';
  const RECIPIENT = 'user-recipient';
  const STRANGER = 'user-stranger';
  const REQUEST_ID = 'req-1';

  const buildRequest = (): DmRequestRecord => ({
    id: REQUEST_ID,
    senderId: SENDER,
    recipientId: RECIPIENT,
    content: 'hello',
    createdAt: new Date('2026-05-19T10:00:00Z'),
  });

  beforeEach(() => {
    directMessageRepo = buildDirectMessageRepoMock();
    useCase = new DeclineDmRequestUseCase(directMessageRepo);
  });

  it('deletes the request when caller is the recipient', async () => {
    directMessageRepo.findRequestById.mockResolvedValue(buildRequest());

    await useCase.execute(RECIPIENT, REQUEST_ID);

    expect(directMessageRepo.declineRequest).toHaveBeenCalledWith(REQUEST_ID);
  });

  it('returns void without calling declineRequest when the request is already gone (idempotent)', async () => {
    directMessageRepo.findRequestById.mockResolvedValue(null);

    await expect(
      useCase.execute(RECIPIENT, REQUEST_ID),
    ).resolves.toBeUndefined();
    expect(directMessageRepo.declineRequest).not.toHaveBeenCalled();
  });

  it('throws NotFoundException (hides existence) when caller is not the recipient', async () => {
    directMessageRepo.findRequestById.mockResolvedValue(buildRequest());

    await expect(useCase.execute(STRANGER, REQUEST_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(directMessageRepo.declineRequest).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the original sender tries to decline their own request', async () => {
    directMessageRepo.findRequestById.mockResolvedValue(buildRequest());

    await expect(useCase.execute(SENDER, REQUEST_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(directMessageRepo.declineRequest).not.toHaveBeenCalled();
  });
});
