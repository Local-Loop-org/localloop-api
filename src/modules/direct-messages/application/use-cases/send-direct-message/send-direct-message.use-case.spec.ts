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
    new DirectMessage({
      id: 'dm-1',
      senderId: SENDER,
      recipientId: RECIPIENT,
      content: 'hello',
      mediaUrl: null,
      mediaType: null,
      isDeleted: false,
      replyToMessageId: null,
      editedAt: null,
      createdAt: new Date('2026-05-16T10:00:00Z'),
    });

  const buildRow = (
    overrides: Partial<DirectMessageRow> = {},
  ): DirectMessageRow => ({
    id: 'dm-1',
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
    createdAt: new Date('2026-05-16T10:00:00Z'),
    ...overrides,
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
    directMessageRepo.createDirectDeliveryAtomic.mockResolvedValue(buildDm());
    directMessageRepo.findByIdWithSender.mockResolvedValue(buildRow());

    const result = await useCase.execute(SENDER, RECIPIENT, {
      content: 'hello',
    });

    expect(result).toMatchObject({
      type: 'message',
      id: 'dm-1',
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
      createdAt: '2026-05-16T10:00:00.000Z',
    });
    expect(directMessageRepo.createDirectDeliveryAtomic).toHaveBeenCalledWith({
      senderId: SENDER,
      recipientId: RECIPIENT,
      content: 'hello',
      mediaUrl: null,
      mediaType: null,
      replyToMessageId: null,
    });
    expect(result).toMatchObject({ clientMessageId: null });
  });

  it('echoes clientMessageId back on the message-branch response when provided', async () => {
    userRepo.findById.mockResolvedValue(
      buildUser({ id: RECIPIENT, dmPermission: DmPermission.EVERYONE }),
    );
    directMessageRepo.createDirectDeliveryAtomic.mockResolvedValue(buildDm());
    directMessageRepo.findByIdWithSender.mockResolvedValue(buildRow());

    const result = await useCase.execute(SENDER, RECIPIENT, {
      content: 'hello',
      clientMessageId: 'temp-1717000000000-abc123',
    });

    expect(result).toMatchObject({
      type: 'message',
      clientMessageId: 'temp-1717000000000-abc123',
    });
  });

  it('does not surface clientMessageId on the request-branch response', async () => {
    userRepo.findById.mockResolvedValue(
      buildUser({ id: RECIPIENT, dmPermission: DmPermission.NOBODY }),
    );
    directMessageRepo.createRequest.mockResolvedValue({ id: 'req-1' });

    const result = await useCase.execute(SENDER, RECIPIENT, {
      content: 'hi',
      clientMessageId: 'temp-1717000000000-abc123',
    });

    expect(result).toEqual({ type: 'request', requestId: 'req-1' });
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
    expect(directMessageRepo.createDirectDeliveryAtomic).not.toHaveBeenCalled();
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
    expect(directMessageRepo.createDirectDeliveryAtomic).not.toHaveBeenCalled();
  });

  it('creates a request when MEMBERS and no shared group', async () => {
    userRepo.findById.mockResolvedValue(
      buildUser({ id: RECIPIENT, dmPermission: DmPermission.MEMBERS }),
    );
    groupRepo.hasSharedActiveGroup.mockResolvedValue(false);
    directMessageRepo.createRequest.mockResolvedValue({ id: 'req-2' });

    const result = await useCase.execute(SENDER, RECIPIENT, { content: 'hi' });

    expect(result).toEqual({ type: 'request', requestId: 'req-2' });
    expect(directMessageRepo.createDirectDeliveryAtomic).not.toHaveBeenCalled();
  });

  it('sends direct message when MEMBERS and shares active group', async () => {
    userRepo.findById.mockResolvedValue(
      buildUser({ id: RECIPIENT, dmPermission: DmPermission.MEMBERS }),
    );
    groupRepo.hasSharedActiveGroup.mockResolvedValue(true);
    directMessageRepo.createDirectDeliveryAtomic.mockResolvedValue(buildDm());
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
    directMessageRepo.createDirectDeliveryAtomic.mockResolvedValue(buildDm());
    directMessageRepo.findByIdWithSender.mockResolvedValue(buildRow());

    const result = await useCase.execute(SENDER, RECIPIENT, {
      content: 'hello',
    });

    expect(result).toMatchObject({ type: 'message', id: 'dm-1' });
    expect(directMessageRepo.createRequest).not.toHaveBeenCalled();
    expect(groupRepo.hasSharedActiveGroup).not.toHaveBeenCalled();
  });

  it('repeat sends invoke createDirectDeliveryAtomic each time (idempotent side-table writes)', async () => {
    userRepo.findById.mockResolvedValue(
      buildUser({ id: RECIPIENT, dmPermission: DmPermission.EVERYONE }),
    );
    directMessageRepo.createDirectDeliveryAtomic.mockResolvedValue(buildDm());
    directMessageRepo.findByIdWithSender.mockResolvedValue(buildRow());

    await useCase.execute(SENDER, RECIPIENT, { content: 'hello' });
    await useCase.execute(SENDER, RECIPIENT, { content: 'hello' });

    expect(directMessageRepo.createDirectDeliveryAtomic).toHaveBeenCalledTimes(
      2,
    );
  });

  it('skips the shared-group check when EVERYONE', async () => {
    userRepo.findById.mockResolvedValue(
      buildUser({ id: RECIPIENT, dmPermission: DmPermission.EVERYONE }),
    );
    directMessageRepo.createDirectDeliveryAtomic.mockResolvedValue(buildDm());
    directMessageRepo.findByIdWithSender.mockResolvedValue(buildRow());

    await useCase.execute(SENDER, RECIPIENT, { content: 'hello' });

    expect(groupRepo.hasSharedActiveGroup).not.toHaveBeenCalled();
  });

  describe('replyToMessageId', () => {
    const parentId = 'parent-dm-1';

    const buildParent = (
      overrides: Partial<{
        senderId: string;
        recipientId: string;
        isDeleted: boolean;
      }> = {},
    ): DirectMessage =>
      new DirectMessage({
        id: parentId,
        senderId: overrides.senderId ?? RECIPIENT,
        recipientId: overrides.recipientId ?? SENDER,
        content: 'original',
        mediaUrl: null,
        mediaType: null,
        isDeleted: overrides.isDeleted ?? false,
        replyToMessageId: null,
        editedAt: null,
        createdAt: new Date('2026-05-16T09:00:00Z'),
      });

    it('forwards the denormalised replyTo from the row into the response (deleted parent ⇒ snippet null, isDeleted true)', async () => {
      userRepo.findById.mockResolvedValue(
        buildUser({ id: RECIPIENT, dmPermission: DmPermission.EVERYONE }),
      );
      directMessageRepo.findById.mockResolvedValue(buildParent());
      directMessageRepo.createDirectDeliveryAtomic.mockResolvedValue(buildDm());
      directMessageRepo.findByIdWithSender.mockResolvedValue(
        buildRow({
          replyTo: {
            id: parentId,
            authorId: RECIPIENT,
            snippet: null,
            isDeleted: true,
          },
        }),
      );

      const result = await useCase.execute(SENDER, RECIPIENT, {
        content: 'hi',
        replyToMessageId: parentId,
      });

      if (result.type !== 'message') throw new Error('expected message');
      expect(result.replyTo).toEqual({
        id: parentId,
        authorId: RECIPIENT,
        snippet: null,
        isDeleted: true,
      });
    });

    it('persists the reply when parent is in the same conversation (peer-authored)', async () => {
      userRepo.findById.mockResolvedValue(
        buildUser({ id: RECIPIENT, dmPermission: DmPermission.EVERYONE }),
      );
      directMessageRepo.findById.mockResolvedValue(buildParent());
      directMessageRepo.createDirectDeliveryAtomic.mockResolvedValue(buildDm());
      directMessageRepo.findByIdWithSender.mockResolvedValue(buildRow());

      await useCase.execute(SENDER, RECIPIENT, {
        content: 'hi',
        replyToMessageId: parentId,
      });

      expect(directMessageRepo.findById).toHaveBeenCalledWith(parentId);
      expect(directMessageRepo.createDirectDeliveryAtomic).toHaveBeenCalledWith(
        {
          senderId: SENDER,
          recipientId: RECIPIENT,
          content: 'hi',
          mediaUrl: null,
          mediaType: null,
          replyToMessageId: parentId,
        },
      );
    });

    it('rejects when the reply target does not exist', async () => {
      userRepo.findById.mockResolvedValue(
        buildUser({ id: RECIPIENT, dmPermission: DmPermission.EVERYONE }),
      );
      directMessageRepo.findById.mockResolvedValue(null);

      await expect(
        useCase.execute(SENDER, RECIPIENT, {
          content: 'hi',
          replyToMessageId: parentId,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(
        directMessageRepo.createDirectDeliveryAtomic,
      ).not.toHaveBeenCalled();
    });

    it('rejects when the reply target belongs to a different conversation', async () => {
      userRepo.findById.mockResolvedValue(
        buildUser({ id: RECIPIENT, dmPermission: DmPermission.EVERYONE }),
      );
      directMessageRepo.findById.mockResolvedValue(
        buildParent({ senderId: 'other-user', recipientId: SENDER }),
      );

      await expect(
        useCase.execute(SENDER, RECIPIENT, {
          content: 'hi',
          replyToMessageId: parentId,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(
        directMessageRepo.createDirectDeliveryAtomic,
      ).not.toHaveBeenCalled();
    });

    it('rejects when the reply target is deleted', async () => {
      userRepo.findById.mockResolvedValue(
        buildUser({ id: RECIPIENT, dmPermission: DmPermission.EVERYONE }),
      );
      directMessageRepo.findById.mockResolvedValue(
        buildParent({ isDeleted: true }),
      );

      await expect(
        useCase.execute(SENDER, RECIPIENT, {
          content: 'hi',
          replyToMessageId: parentId,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(
        directMessageRepo.createDirectDeliveryAtomic,
      ).not.toHaveBeenCalled();
    });
  });
});
