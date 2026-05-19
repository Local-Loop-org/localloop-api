import { BadRequestException, NotFoundException } from '@nestjs/common';

import { IDirectMessageRepository } from '@/modules/direct-messages/domain/repositories/i-direct-message.repository';
import { IUserRepository } from '@/modules/auth/domain/repositories/i-user.repository';
import { buildDirectMessageRepoMock } from '@/modules/direct-messages/test/direct-message-repo.mock';
import {
  buildUser,
  buildUserRepoMock,
} from '@/modules/direct-messages/test/user-repo.mock';
import { AddDmExceptionUseCase } from './add-dm-exception.use-case';

describe('AddDmExceptionUseCase', () => {
  let useCase: AddDmExceptionUseCase;
  let directMessageRepo: jest.Mocked<IDirectMessageRepository>;
  let userRepo: jest.Mocked<IUserRepository>;

  const CALLER = 'user-caller';
  const PEER = 'user-peer';

  beforeEach(() => {
    directMessageRepo = buildDirectMessageRepoMock();
    userRepo = buildUserRepoMock();
    useCase = new AddDmExceptionUseCase(directMessageRepo, userRepo);
  });

  it('calls addException for a valid active peer', async () => {
    userRepo.findById.mockResolvedValue(buildUser({ id: PEER }));

    await useCase.execute(CALLER, PEER);

    expect(directMessageRepo.addException).toHaveBeenCalledWith(CALLER, PEER);
    expect(directMessageRepo.addException).toHaveBeenCalledTimes(1);
  });

  it('is idempotent: the use case re-invokes addException on repeat calls', async () => {
    userRepo.findById.mockResolvedValue(buildUser({ id: PEER }));

    await useCase.execute(CALLER, PEER);
    await useCase.execute(CALLER, PEER);

    expect(directMessageRepo.addException).toHaveBeenCalledTimes(2);
  });

  it('rejects self-pair with BadRequestException', async () => {
    await expect(useCase.execute(CALLER, CALLER)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(userRepo.findById).not.toHaveBeenCalled();
    expect(directMessageRepo.addException).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the peer does not exist', async () => {
    userRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute(CALLER, PEER)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(directMessageRepo.addException).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the peer is inactive', async () => {
    userRepo.findById.mockResolvedValue(
      buildUser({ id: PEER, isActive: false }),
    );

    await expect(useCase.execute(CALLER, PEER)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(directMessageRepo.addException).not.toHaveBeenCalled();
  });
});
