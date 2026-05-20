import { BadRequestException } from '@nestjs/common';

import { IDirectMessageRepository } from '@/modules/direct-messages/domain/repositories/i-direct-message.repository';
import { buildDirectMessageRepoMock } from '@/modules/direct-messages/test/direct-message-repo.mock';
import { UnarchiveDmConversationUseCase } from './unarchive-dm-conversation.use-case';

describe('UnarchiveDmConversationUseCase', () => {
  let useCase: UnarchiveDmConversationUseCase;
  let directMessageRepo: jest.Mocked<IDirectMessageRepository>;

  const CALLER = 'user-caller';
  const PEER = 'user-peer';

  beforeEach(() => {
    directMessageRepo = buildDirectMessageRepoMock();
    useCase = new UnarchiveDmConversationUseCase(directMessageRepo);
  });

  it('upserts archived = false on the caller side', async () => {
    await useCase.execute(CALLER, PEER);

    expect(directMessageRepo.setArchived).toHaveBeenCalledWith(
      CALLER,
      PEER,
      false,
    );
  });

  it('rejects self-unarchive with BadRequestException', async () => {
    await expect(useCase.execute(CALLER, CALLER)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(directMessageRepo.setArchived).not.toHaveBeenCalled();
  });

  it('is idempotent — repeat call writes the same row again', async () => {
    await useCase.execute(CALLER, PEER);
    await useCase.execute(CALLER, PEER);

    expect(directMessageRepo.setArchived).toHaveBeenCalledTimes(2);
    expect(directMessageRepo.setArchived).toHaveBeenNthCalledWith(
      2,
      CALLER,
      PEER,
      false,
    );
  });
});
