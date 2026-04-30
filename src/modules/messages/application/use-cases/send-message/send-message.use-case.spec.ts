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
} from '@localloop/shared-types';

import { Group } from '@/modules/groups/domain/entities/group.entity';
import { GroupMember } from '@/modules/groups/domain/entities/group-member.entity';
import { IGroupRepository } from '@/modules/groups/domain/repositories/i-group.repository';
import { Message } from '../../../domain/entities/message.entity';
import {
  IMessageRepository,
  MessageRow,
} from '../../../domain/repositories/i-message.repository';
import { SendMessageUseCase } from './send-message.use-case';

describe('SendMessageUseCase', () => {
  let useCase: SendMessageUseCase;
  let messageRepo: jest.Mocked<IMessageRepository>;
  let groupRepo: jest.Mocked<IGroupRepository>;

  const buildGroup = (): Group =>
    new Group(
      'group-1',
      'Morumbi Runners',
      null,
      AnchorType.NEIGHBORHOOD,
      '6gyf4',
      -23.55,
      -46.63,
      'Morumbi',
      GroupPrivacy.OPEN,
      'owner-1',
      5,
      true,
      new Date('2026-04-23T00:00:00Z'),
    );

  const buildMember = (status: MemberStatus): GroupMember =>
    new GroupMember(
      'mem-1',
      'group-1',
      'user-1',
      MemberRole.MEMBER,
      status,
      new Date(),
    );

  const buildMessage = (): Message =>
    new Message(
      'msg-1',
      'group-1',
      'user-1',
      'hello',
      null,
      null,
      false,
      new Date('2026-04-24T10:00:00Z'),
    );

  const buildRow = (): MessageRow => ({
    id: 'msg-1',
    groupId: 'group-1',
    senderId: 'user-1',
    senderName: 'Alice',
    senderAvatar: null,
    content: 'hello',
    mediaUrl: null,
    mediaType: null,
    createdAt: new Date('2026-04-24T10:00:00Z'),
  });

  beforeEach(() => {
    messageRepo = buildMessageRepoMock();
    groupRepo = buildGroupRepoMock();
    useCase = new SendMessageUseCase(messageRepo, groupRepo);
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
    });
    expect(result).toEqual({
      id: 'msg-1',
      groupId: 'group-1',
      senderId: 'user-1',
      senderName: 'Alice',
      senderAvatar: null,
      content: 'hello',
      mediaUrl: null,
      mediaType: null,
      createdAt: '2026-04-24T10:00:00.000Z',
    });
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
});

function buildMessageRepoMock(): jest.Mocked<IMessageRepository> {
  return {
    create: jest.fn(),
    findByIdWithSender: jest.fn(),
    listByGroup: jest.fn(),
  };
}

function buildGroupRepoMock(): jest.Mocked<IGroupRepository> {
  return {
    createGroupWithOwner: jest.fn(),
    findById: jest.fn(),
    findNearby: jest.fn(),
    findMember: jest.fn(),
    addMember: jest.fn(),
    incrementMemberCount: jest.fn(),
    decrementMemberCount: jest.fn(),
    removeMember: jest.fn(),
    updateMemberStatus: jest.fn(),
    findPendingJoinRequest: jest.fn(),
    createJoinRequest: jest.fn(),
    listJoinRequestsByStatus: jest.fn(),
    findJoinRequestById: jest.fn(),
    updateJoinRequestStatus: jest.fn(),
    leaveGroupAtomic: jest.fn(),
    approveJoinRequestAtomic: jest.fn(),
    banMemberAtomic: jest.fn(),
    listMembersPaginated: jest.fn(),
    listMyGroupsByActivity: jest.fn(),
  };
}
