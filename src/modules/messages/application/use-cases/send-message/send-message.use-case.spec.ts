import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AnchorType,
  GroupPrivacy,
  MemberRole,
  MemberStatus,
  MessagePermission,
} from '@localloop/shared-types';
import { getNeighborCells } from '@localloop/geo-utils';

import { Group } from '@/modules/groups/domain/entities/group.entity';
import { GroupMember } from '@/modules/groups/domain/entities/group-member.entity';
import { Message } from '@/modules/messages/domain/entities/message.entity';
import {
  IMessageRepository,
  MessageRow,
} from '@/modules/messages/domain/repositories/i-message.repository';
import { SendMessageUseCase } from './send-message.use-case';
import { buildGroupRepoMock } from '@/modules/groups/test/group-repo.mock';
import { buildMessageRepoMock } from '@/modules/messages/test/message-repo.mock';
import {
  buildUser,
  buildUserRepoMock,
} from '@/modules/auth/test/user-repo.mock';

describe('SendMessageUseCase', () => {
  let useCase: SendMessageUseCase;
  let messageRepo: jest.Mocked<IMessageRepository>;
  let groupRepo: ReturnType<typeof buildGroupRepoMock>;
  let userRepo: ReturnType<typeof buildUserRepoMock>;

  const buildGroup = (overrides: Partial<Group> = {}): Group => {
    const g = new Group(
      'group-1',
      'Morumbi Runners',
      null,
      AnchorType.NEIGHBORHOOD,
      '6gyf4',
      -23.55,
      -46.63,
      'Morumbi',
      GroupPrivacy.OPEN,
      5,
      'owner-1',
      5,
      true,
      new Date('2026-04-23T00:00:00Z'),
    );
    Object.assign(g, overrides);
    return g;
  };

  const buildMember = (
    status: MemberStatus,
    role: MemberRole = MemberRole.MEMBER,
  ): GroupMember =>
    new GroupMember('mem-1', 'group-1', 'user-1', role, status, new Date());

  const buildMessage = (): Message =>
    new Message({
      id: 'msg-1',
      groupId: 'group-1',
      senderId: 'user-1',
      content: 'hello',
      mediaUrl: null,
      mediaType: null,
      isDeleted: false,
      replyToMessageId: null,
      editedAt: null,
      createdAt: new Date('2026-04-24T10:00:00Z'),
    });

  const buildRow = (overrides: Partial<MessageRow> = {}): MessageRow => ({
    id: 'msg-1',
    groupId: 'group-1',
    senderId: 'user-1',
    senderName: 'Alice',
    senderAvatarUrl: null,
    content: 'hello',
    mediaUrl: null,
    mediaType: null,
    isDeleted: false,
    editedAt: null,
    replyTo: null,
    createdAt: new Date('2026-04-24T10:00:00Z'),
    ...overrides,
  });

  beforeEach(() => {
    messageRepo = buildMessageRepoMock();
    groupRepo = buildGroupRepoMock();
    userRepo = buildUserRepoMock();
    useCase = new SendMessageUseCase(messageRepo, groupRepo, userRepo);
  });

  it('persists the message and returns it enriched with sender info', async () => {
    groupRepo.findById.mockResolvedValue(buildGroup());
    groupRepo.findMember.mockResolvedValue(buildMember(MemberStatus.ACTIVE));
    messageRepo.create.mockResolvedValue(buildMessage());
    messageRepo.findByIdWithSender.mockResolvedValue(buildRow());

    const result = await useCase.execute('user-1', 'group-1', {
      content: 'hello',
    });

    expect(messageRepo.create).toHaveBeenCalledWith({
      groupId: 'group-1',
      senderId: 'user-1',
      content: 'hello',
      mediaUrl: null,
      mediaType: null,
      replyToMessageId: null,
    });
    expect(result).toEqual({
      id: 'msg-1',
      clientMessageId: null,
      groupId: 'group-1',
      senderId: 'user-1',
      senderName: 'Alice',
      senderAvatarUrl: null,
      content: 'hello',
      mediaUrl: null,
      mediaType: null,
      isDeleted: false,
      editedAt: null,
      replyTo: null,
      createdAt: '2026-04-24T10:00:00.000Z',
    });
  });

  it('echoes clientMessageId back on the response when provided', async () => {
    groupRepo.findById.mockResolvedValue(buildGroup());
    groupRepo.findMember.mockResolvedValue(buildMember(MemberStatus.ACTIVE));
    messageRepo.create.mockResolvedValue(buildMessage());
    messageRepo.findByIdWithSender.mockResolvedValue(buildRow());

    const result = await useCase.execute('user-1', 'group-1', {
      content: 'hello',
      clientMessageId: 'temp-1717000000000-abc123',
    });

    expect(result.clientMessageId).toBe('temp-1717000000000-abc123');
  });

  it('trims whitespace-only content and rejects as empty', async () => {
    await expect(
      useCase.execute('user-1', 'group-1', { content: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(groupRepo.findById).not.toHaveBeenCalled();
  });

  it('rejects missing content', async () => {
    await expect(
      useCase.execute('user-1', 'group-1', {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when group does not exist', async () => {
    groupRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('user-1', 'group-1', { content: 'hi' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(messageRepo.create).not.toHaveBeenCalled();
  });

  it('rejects non-members', async () => {
    groupRepo.findById.mockResolvedValue(buildGroup());
    groupRepo.findMember.mockResolvedValue(null);

    await expect(
      useCase.execute('user-1', 'group-1', { content: 'hi' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(messageRepo.create).not.toHaveBeenCalled();
  });

  it('rejects banned members', async () => {
    groupRepo.findById.mockResolvedValue(buildGroup());
    groupRepo.findMember.mockResolvedValue(buildMember(MemberStatus.BANNED));

    await expect(
      useCase.execute('user-1', 'group-1', { content: 'hi' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(messageRepo.create).not.toHaveBeenCalled();
  });

  describe('sendTextPerm policy', () => {
    const happyPathMocks = () => {
      messageRepo.create.mockResolvedValue(buildMessage());
      messageRepo.findByIdWithSender.mockResolvedValue(buildRow());
    };

    it('skips the sender lookup entirely under ALL_MEMBERS', async () => {
      groupRepo.findById.mockResolvedValue(buildGroup());
      groupRepo.findMember.mockResolvedValue(buildMember(MemberStatus.ACTIVE));
      happyPathMocks();

      await useCase.execute('user-1', 'group-1', { content: 'hi' });

      expect(userRepo.findById).not.toHaveBeenCalled();
    });

    describe('ADMIN_ONLY', () => {
      const adminOnlyGroup = () =>
        buildGroup({ sendTextPerm: MessagePermission.ADMIN_ONLY });

      it('rejects plain members', async () => {
        groupRepo.findById.mockResolvedValue(adminOnlyGroup());
        groupRepo.findMember.mockResolvedValue(
          buildMember(MemberStatus.ACTIVE, MemberRole.MEMBER),
        );

        await expect(
          useCase.execute('user-1', 'group-1', { content: 'hi' }),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(messageRepo.create).not.toHaveBeenCalled();
      });

      it.each([MemberRole.OWNER, MemberRole.MODERATOR])(
        'allows %s senders',
        async (role) => {
          groupRepo.findById.mockResolvedValue(adminOnlyGroup());
          groupRepo.findMember.mockResolvedValue(
            buildMember(MemberStatus.ACTIVE, role),
          );
          happyPathMocks();

          await useCase.execute('user-1', 'group-1', { content: 'hi' });

          expect(messageRepo.create).toHaveBeenCalled();
        },
      );
    });

    describe('MEMBERS_IN_RADIUS', () => {
      const anchorCell = '6gyf4';
      const radiusGroup = () =>
        buildGroup({ sendTextPerm: MessagePermission.MEMBERS_IN_RADIUS });

      it('allows a sender whose geohash equals the anchor cell', async () => {
        groupRepo.findById.mockResolvedValue(radiusGroup());
        groupRepo.findMember.mockResolvedValue(
          buildMember(MemberStatus.ACTIVE),
        );
        userRepo.findById.mockResolvedValue(
          buildUser({ id: 'user-1', geohash: anchorCell }),
        );
        happyPathMocks();

        await useCase.execute('user-1', 'group-1', { content: 'hi' });

        expect(userRepo.findById).toHaveBeenCalledWith('user-1');
        expect(messageRepo.create).toHaveBeenCalled();
      });

      it('allows a sender located in a neighbor cell of the anchor', async () => {
        groupRepo.findById.mockResolvedValue(radiusGroup());
        groupRepo.findMember.mockResolvedValue(
          buildMember(MemberStatus.ACTIVE),
        );
        userRepo.findById.mockResolvedValue(
          buildUser({ id: 'user-1', geohash: getNeighborCells(anchorCell)[0] }),
        );
        happyPathMocks();

        await useCase.execute('user-1', 'group-1', { content: 'hi' });

        expect(messageRepo.create).toHaveBeenCalled();
      });

      it('rejects a sender outside the anchor neighborhood', async () => {
        groupRepo.findById.mockResolvedValue(radiusGroup());
        groupRepo.findMember.mockResolvedValue(
          buildMember(MemberStatus.ACTIVE),
        );
        userRepo.findById.mockResolvedValue(
          buildUser({ id: 'user-1', geohash: 'dr5ru7' }),
        );

        await expect(
          useCase.execute('user-1', 'group-1', { content: 'hi' }),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(messageRepo.create).not.toHaveBeenCalled();
      });

      it('rejects a sender with no known geohash', async () => {
        groupRepo.findById.mockResolvedValue(radiusGroup());
        groupRepo.findMember.mockResolvedValue(
          buildMember(MemberStatus.ACTIVE),
        );
        userRepo.findById.mockResolvedValue(
          buildUser({ id: 'user-1', geohash: null }),
        );

        await expect(
          useCase.execute('user-1', 'group-1', { content: 'hi' }),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(messageRepo.create).not.toHaveBeenCalled();
      });
    });
  });

  describe('replyToMessageId', () => {
    const parentId = 'parent-msg-1';

    const buildParent = (
      overrides: Partial<{ groupId: string; isDeleted: boolean }> = {},
    ): Message =>
      new Message({
        id: parentId,
        groupId: overrides.groupId ?? 'group-1',
        senderId: 'user-2',
        content: 'original',
        mediaUrl: null,
        mediaType: null,
        isDeleted: overrides.isDeleted ?? false,
        replyToMessageId: null,
        editedAt: null,
        createdAt: new Date('2026-04-24T09:00:00Z'),
      });

    it('persists the reply and forwards replyToMessageId to the repository', async () => {
      groupRepo.findById.mockResolvedValue(buildGroup());
      groupRepo.findMember.mockResolvedValue(buildMember(MemberStatus.ACTIVE));
      messageRepo.findById.mockResolvedValue(buildParent());
      messageRepo.create.mockResolvedValue(buildMessage());
      messageRepo.findByIdWithSender.mockResolvedValue(buildRow());

      await useCase.execute('user-1', 'group-1', {
        content: 'hi',
        replyToMessageId: parentId,
      });

      expect(messageRepo.findById).toHaveBeenCalledWith(parentId);
      expect(messageRepo.create).toHaveBeenCalledWith({
        groupId: 'group-1',
        senderId: 'user-1',
        content: 'hi',
        mediaUrl: null,
        mediaType: null,
        replyToMessageId: parentId,
      });
    });

    it('forwards the denormalised replyTo from the row into the response', async () => {
      groupRepo.findById.mockResolvedValue(buildGroup());
      groupRepo.findMember.mockResolvedValue(buildMember(MemberStatus.ACTIVE));
      messageRepo.findById.mockResolvedValue(buildParent());
      messageRepo.create.mockResolvedValue(buildMessage());
      messageRepo.findByIdWithSender.mockResolvedValue(
        buildRow({
          replyTo: {
            id: parentId,
            authorId: 'user-2',
            snippet: 'original',
            isDeleted: false,
          },
        }),
      );

      const result = await useCase.execute('user-1', 'group-1', {
        content: 'hi',
        replyToMessageId: parentId,
      });

      expect(result.replyTo).toEqual({
        id: parentId,
        authorId: 'user-2',
        snippet: 'original',
        isDeleted: false,
      });
    });

    it('rejects when the reply target does not exist', async () => {
      groupRepo.findById.mockResolvedValue(buildGroup());
      groupRepo.findMember.mockResolvedValue(buildMember(MemberStatus.ACTIVE));
      messageRepo.findById.mockResolvedValue(null);

      await expect(
        useCase.execute('user-1', 'group-1', {
          content: 'hi',
          replyToMessageId: parentId,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(messageRepo.create).not.toHaveBeenCalled();
    });

    it('rejects when the reply target belongs to a different group', async () => {
      groupRepo.findById.mockResolvedValue(buildGroup());
      groupRepo.findMember.mockResolvedValue(buildMember(MemberStatus.ACTIVE));
      messageRepo.findById.mockResolvedValue(
        buildParent({ groupId: 'other-group' }),
      );

      await expect(
        useCase.execute('user-1', 'group-1', {
          content: 'hi',
          replyToMessageId: parentId,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(messageRepo.create).not.toHaveBeenCalled();
    });

    it('rejects when the reply target is deleted', async () => {
      groupRepo.findById.mockResolvedValue(buildGroup());
      groupRepo.findMember.mockResolvedValue(buildMember(MemberStatus.ACTIVE));
      messageRepo.findById.mockResolvedValue(buildParent({ isDeleted: true }));

      await expect(
        useCase.execute('user-1', 'group-1', {
          content: 'hi',
          replyToMessageId: parentId,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(messageRepo.create).not.toHaveBeenCalled();
    });
  });
});
