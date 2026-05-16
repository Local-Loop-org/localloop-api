import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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
    userRepo = buildUserRepoMock();
    groupRepo = buildGroupRepoMock();
    useCase = new SendDirectMessageUseCase(
      directMessageRepo,
      userRepo,
      groupRepo,
    );
  });

  it('persists the DM and returns it enriched with sender info', async () => {
    userRepo.findById.mockResolvedValue(
      buildUser({ id: RECIPIENT, dmPermission: DmPermission.EVERYONE }),
    );
    directMessageRepo.create.mockResolvedValue(buildDm());
    directMessageRepo.findByIdWithSender.mockResolvedValue(buildRow());

    const result = await useCase.execute(SENDER, RECIPIENT, {
      content: 'hello',
    });

    expect(directMessageRepo.create).toHaveBeenCalledWith({
      senderId: SENDER,
      recipientId: RECIPIENT,
      content: 'hello',
      mediaUrl: null,
      mediaType: null,
    });
    expect(result).toEqual({
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

  it('rejects when recipient is inactive (soft-banned)', async () => {
    userRepo.findById.mockResolvedValue(
      buildUser({ id: RECIPIENT, isActive: false }),
    );

    await expect(
      useCase.execute(SENDER, RECIPIENT, { content: 'hi' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects when recipient's dmPermission is NOBODY", async () => {
    userRepo.findById.mockResolvedValue(
      buildUser({ id: RECIPIENT, dmPermission: DmPermission.NOBODY }),
    );

    await expect(
      useCase.execute(SENDER, RECIPIENT, { content: 'hi' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(groupRepo.hasSharedActiveGroup).not.toHaveBeenCalled();
    expect(directMessageRepo.create).not.toHaveBeenCalled();
  });

  it('allows when dmPermission is MEMBERS and sender shares an active group', async () => {
    userRepo.findById.mockResolvedValue(
      buildUser({ id: RECIPIENT, dmPermission: DmPermission.MEMBERS }),
    );
    groupRepo.hasSharedActiveGroup.mockResolvedValue(true);
    directMessageRepo.create.mockResolvedValue(buildDm());
    directMessageRepo.findByIdWithSender.mockResolvedValue(buildRow());

    const result = await useCase.execute(SENDER, RECIPIENT, {
      content: 'hello',
    });

    expect(groupRepo.hasSharedActiveGroup).toHaveBeenCalledWith(
      SENDER,
      RECIPIENT,
    );
    expect(result.id).toBe('dm-1');
  });

  it('rejects when dmPermission is MEMBERS but sender shares no active group', async () => {
    userRepo.findById.mockResolvedValue(
      buildUser({ id: RECIPIENT, dmPermission: DmPermission.MEMBERS }),
    );
    groupRepo.hasSharedActiveGroup.mockResolvedValue(false);

    await expect(
      useCase.execute(SENDER, RECIPIENT, { content: 'hi' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(directMessageRepo.create).not.toHaveBeenCalled();
  });

  it('skips the shared-group check when dmPermission is EVERYONE', async () => {
    userRepo.findById.mockResolvedValue(
      buildUser({ id: RECIPIENT, dmPermission: DmPermission.EVERYONE }),
    );
    directMessageRepo.create.mockResolvedValue(buildDm());
    directMessageRepo.findByIdWithSender.mockResolvedValue(buildRow());

    await useCase.execute(SENDER, RECIPIENT, { content: 'hello' });

    expect(groupRepo.hasSharedActiveGroup).not.toHaveBeenCalled();
  });
});
