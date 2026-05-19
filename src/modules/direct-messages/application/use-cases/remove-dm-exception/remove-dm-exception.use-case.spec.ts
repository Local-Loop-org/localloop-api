import { BadRequestException } from '@nestjs/common';

import { IDirectMessageRepository } from '@/modules/direct-messages/domain/repositories/i-direct-message.repository';
import { buildDirectMessageRepoMock } from '@/modules/direct-messages/test/direct-message-repo.mock';
import { RemoveDmExceptionUseCase } from './remove-dm-exception.use-case';

describe('RemoveDmExceptionUseCase', () => {
  let useCase: RemoveDmExceptionUseCase;
  let directMessageRepo: jest.Mocked<IDirectMessageRepository>;

  const CALLER = 'user-caller';
  const PEER = 'user-peer';

  beforeEach(() => {
    directMessageRepo = buildDirectMessageRepoMock();
    useCase = new RemoveDmExceptionUseCase(directMessageRepo);
  });

  it('calls removeException for a non-self peer', async () => {
    await useCase.execute(CALLER, PEER);

    expect(directMessageRepo.removeException).toHaveBeenCalledWith(
      CALLER,
      PEER,
    );
  });

  it('is idempotent: repeat calls still delegate to the repo (which is itself idempotent)', async () => {
    await useCase.execute(CALLER, PEER);
    await useCase.execute(CALLER, PEER);

    expect(directMessageRepo.removeException).toHaveBeenCalledTimes(2);
  });

  it('does not throw when the row is absent — the repo DELETE is a no-op', async () => {
    directMessageRepo.removeException.mockResolvedValue(undefined);

    await expect(useCase.execute(CALLER, PEER)).resolves.toBeUndefined();
  });

  it('rejects self-pair with BadRequestException', async () => {
    await expect(useCase.execute(CALLER, CALLER)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(directMessageRepo.removeException).not.toHaveBeenCalled();
  });
});
