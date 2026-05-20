import { BadRequestException } from '@nestjs/common';

import { IDirectMessageRepository } from '@/modules/direct-messages/domain/repositories/i-direct-message.repository';
import { buildDirectMessageRepoMock } from '@/modules/direct-messages/test/direct-message-repo.mock';
import { MarkDmReadUseCase } from './mark-dm-read.use-case';

describe('MarkDmReadUseCase', () => {
  let useCase: MarkDmReadUseCase;
  let directMessageRepo: jest.Mocked<IDirectMessageRepository>;

  const CALLER = 'user-caller';
  const PEER = 'user-peer';
  const NOW = new Date('2026-05-19T12:00:00Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    directMessageRepo = buildDirectMessageRepoMock();
    useCase = new MarkDmReadUseCase(directMessageRepo);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('upserts last_read_at and returns the new timestamp', async () => {
    directMessageRepo.markRead.mockResolvedValue(NOW);

    const result = await useCase.execute(CALLER, PEER);

    expect(directMessageRepo.markRead).toHaveBeenCalledWith(CALLER, PEER, NOW);
    expect(result).toEqual({ lastReadAt: NOW });
  });

  it('rejects self-DM with BadRequestException', async () => {
    await expect(useCase.execute(CALLER, CALLER)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(directMessageRepo.markRead).not.toHaveBeenCalled();
  });

  it('is idempotent — repeat call yields the same upsert', async () => {
    directMessageRepo.markRead.mockResolvedValue(NOW);

    await useCase.execute(CALLER, PEER);
    await useCase.execute(CALLER, PEER);

    expect(directMessageRepo.markRead).toHaveBeenCalledTimes(2);
    expect(directMessageRepo.markRead).toHaveBeenNthCalledWith(
      2,
      CALLER,
      PEER,
      NOW,
    );
  });
});
