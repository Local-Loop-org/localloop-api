import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DmPermission } from '@localloop/shared-types';

import { DirectMessage } from '@/modules/direct-messages/domain/entities/direct-message.entity';
import {
  DirectMessageRow,
  IDirectMessageRepository,
} from '@/modules/direct-messages/domain/repositories/i-direct-message.repository';
import { IUserRepository } from '@/modules/auth/domain/repositories/i-user.repository';
import { buildGroupRepoMock } from '@/modules/groups/test/group-repo.mock';
import {
  buildUser,
  buildUserRepoMock,
} from '@/modules/direct-messages/test/user-repo.mock';
import { buildDirectMessageRepoMock } from '@/modules/direct-messages/test/direct-message-repo.mock';
import { SendDirectMessageUseCase } from './send-direct-message.use-case';

describe('SendDirectMessageUseCase', () => {
  let useCase: SendDirectMessageUseCase;
  let directMessageRepo: jest.Mocked<IDirectMessageRepository>;
  let userRepo: jest.Mocked<IUserRepository>;
  let groupRepo: ReturnType<typeof buildGroupRepoMock>;

  const SENDER = 'user-sender';
  const RECIPIENT = 'user-recipient';

  const buildDm = (): DirectMessage =>
    new DirectMessage(
      'dm-1',
      SENDER,
      RECIPIENT,
      'hello',
      null,
      null,
      false,
      new Date('2026-05-16T10:00:00Z'),
    );

  const buildRow = (): DirectMessageRow => ({
    id: 'dm-1',
    senderId: SENDER,
    senderName: 'Alice',
    senderAvatar: null,
    recipientId: RECIPIENT,
    content: 'hello',
    mediaUrl: null,
    mediaType: null,
    createdAt: new Date('2026-05-16T10:00:00Z'),
  });

  beforeEach(() => {
    directMessageRepo = buildDirectMessageRepoMock();
    directMessageRepo.hasPermissionException.mockResolvedValue(false);
    userRepo = buildUserRepoMock();
    groupRepo = buildGroupRepoMock();
    useCase = new SendDirectMessageUseCase(
      directMessageRepo,
      userRepo,
      groupRepo,
    );
  });

  it('persists the DM and returns type=message when EVERYONE', async () => {
    userRepo.findById.mockResolvedValue(
      buildUser({ id: RECIPIENT, dmPermission: DmPermission.EVERYONE }),
    );
    directMessageRepo.create.mockResolvedValue(buildDm());
    directMessageRepo.findByIdWithSender.mockResolvedValue(buildRow());

    const result = await useCase.execute(SENDER, RECIPIENT, {
      content: 'hello',
    });

    expect(result).toMatchObject({
      type: 'message',
      id: 'dm-1',
      senderId: SENDER,
      senderName: 'Alice',
      senderAvatar: null,
      recipientId: RECIPIENT,
      content: 'hello',
      mediaUrl: null,
      mediaType: null,
      createdAt: '2026-05-16T10:00:00.000Z',
    });
    expect(directMessageRepo.create).toHaveBeenCalledWith({
      senderId: SENDER,
      recipientId: RECIPIENT,
      content: 'hello',
      mediaUrl: null,
      mediaType: null,
    });
  });

  it('rejects sending DM to self', async () => {
    await expect(
      useCase.execute(SENDER, SENDER, { content: 'hi' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(userRepo.findById).not.toHaveBeenCalled();
  });

  it('rejects whitespace-only content as empty', async () => {
    await expect(
      useCase.execute(SENDER, RECIPIENT, { content: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(userRepo.findById).not.toHaveBeenCalled();
  });

  it('rejects missing content', async () => {
    await expect(useCase.execute(SENDER, RECIPIENT, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects when recipient does not exist', async () => {
    userRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(SENDER, RECIPIENT, { content: 'hi' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(directMessageRepo.create).not.toHaveBeenCalled();
  });

  it('rejects when recipient is inactive', async () => {
    userRepo.findById.mockResolvedValue(
      buildUser({ id: RECIPIENT, isActive: false }),
    );

    await expect(
      useCase.execute(SENDER, RECIPIENT, { content: 'hi' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a request when dmPermission is NOBODY', async () => {
    userRepo.findById.mockResolvedValue(
      buildUser({ id: RECIPIENT, dmPermission: DmPermission.NOBODY }),
    );
    directMessageRepo.createRequest.mockResolvedValue({ id: 'req-1' });

    const result = await useCase.execute(SENDER, RECIPIENT, { content: 'hi' });

    expect(result).toEqual({ type: 'request', requestId: 'req-1' });
    expect(directMessageRepo.createRequest).toHaveBeenCalledWith({
      senderId: SENDER,
      recipientId: RECIPIENT,
      content: 'hi',
    });
    expect(directMessageRepo.create).not.toHaveBeenCalled();
  });

  it('creates a request when MEMBERS and no shared group', async () => {
    userRepo.findById.mockResolvedValue(
      buildUser({ id: RECIPIENT, dmPermission: DmPermission.MEMBERS }),
    );
    groupRepo.hasSharedActiveGroup.mockResolvedValue(false);
    directMessageRepo.createRequest.mockResolvedValue({ id: 'req-2' });

    const result = await useCase.execute(SENDER, RECIPIENT, { content: 'hi' });

    expect(result).toEqual({ type: 'request', requestId: 'req-2' });
    expect(directMessageRepo.create).not.toHaveBeenCalled();
  });

  it('sends direct message when MEMBERS and shares active group', async () => {
    userRepo.findById.mockResolvedValue(
      buildUser({ id: RECIPIENT, dmPermission: DmPermission.MEMBERS }),
    );
    groupRepo.hasSharedActiveGroup.mockResolvedValue(true);
    directMessageRepo.create.mockResolvedValue(buildDm());
    directMessageRepo.findByIdWithSender.mockResolvedValue(buildRow());

    const result = await useCase.execute(SENDER, RECIPIENT, {
      content: 'hello',
    });

    expect(result).toMatchObject({ type: 'message', id: 'dm-1' });
    expect(groupRepo.hasSharedActiveGroup).toHaveBeenCalledWith(
      SENDER,
      RECIPIENT,
    );
  });

  it('sends direct message when NOBODY but sender is in exceptions', async () => {
    userRepo.findById.mockResolvedValue(
      buildUser({ id: RECIPIENT, dmPermission: DmPermission.NOBODY }),
    );
    directMessageRepo.hasPermissionException.mockResolvedValue(true);
    directMessageRepo.create.mockResolvedValue(buildDm());
    directMessageRepo.findByIdWithSender.mockResolvedValue(buildRow());

    const result = await useCase.execute(SENDER, RECIPIENT, {
      content: 'hello',
    });

    expect(result).toMatchObject({ type: 'message', id: 'dm-1' });
    expect(directMessageRepo.createRequest).not.toHaveBeenCalled();
    expect(groupRepo.hasSharedActiveGroup).not.toHaveBeenCalled();
  });

  it('skips the shared-group check when EVERYONE', async () => {
    userRepo.findById.mockResolvedValue(
      buildUser({ id: RECIPIENT, dmPermission: DmPermission.EVERYONE }),
    );
    directMessageRepo.create.mockResolvedValue(buildDm());
    directMessageRepo.findByIdWithSender.mockResolvedValue(buildRow());

    await useCase.execute(SENDER, RECIPIENT, { content: 'hello' });

    expect(groupRepo.hasSharedActiveGroup).not.toHaveBeenCalled();
  });
});
