import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AnchorType,
  GroupPrivacy,
  MemberRole,
  MemberStatus,
} from '@localloop/shared-types';

import { Group } from '@/modules/groups/domain/entities/group.entity';
import { GroupMember } from '@/modules/groups/domain/entities/group-member.entity';
import {
  IMessageRepository,
  MessageRow,
} from '@/modules/messages/domain/repositories/i-message.repository';
import { GetMessageHistoryUseCase } from './get-message-history.use-case';
import { buildGroupRepoMock } from '@/modules/groups/test/group-repo.mock';

describe('GetMessageHistoryUseCase', () => {
  let useCase: GetMessageHistoryUseCase;
  let messageRepo: jest.Mocked<IMessageRepository>;
  let groupRepo: ReturnType<typeof buildGroupRepoMock>;

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
      5,
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

  const buildRow = (id: string, at: string): MessageRow => ({
    id,
    groupId: 'group-1',
    senderId: 'user-1',
    senderName: 'Alice',
    senderAvatarUrl: null,
    content: `hello-${id}`,
    mediaUrl: null,
    mediaType: null,
    createdAt: new Date(at),
  });

  beforeEach(() => {
    messageRepo = {
      create: jest.fn(),
      findByIdWithSender: jest.fn(),
      listByGroup: jest.fn(),
    };
    groupRepo = buildGroupRepoMock();
    useCase = new GetMessageHistoryUseCase(messageRepo, groupRepo);
  });

  it('returns serialized messages with nextCursor under the API contract', async () => {
    groupRepo.findById.mockResolvedValue(buildGroup());
    groupRepo.findMember.mockResolvedValue(buildMember(MemberStatus.ACTIVE));
    messageRepo.listByGroup.mockResolvedValue({
      rows: [
        buildRow('m2', '2026-04-24T10:05:00Z'),
        buildRow('m1', '2026-04-24T10:00:00Z'),
      ],
      nextCursor: '2026-04-24T10:00:00.000Z',
    });

    const result = await useCase.execute('user-1', 'group-1', 10, 'cursor');

    expect(messageRepo.listByGroup).toHaveBeenCalledWith(
      'group-1',
      10,
      'cursor',
    );
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toEqual({
      id: 'm2',
      senderId: 'user-1',
      senderName: 'Alice',
      senderAvatarUrl: null,
      content: 'hello-m2',
      mediaUrl: null,
      mediaType: null,
      createdAt: '2026-04-24T10:05:00.000Z',
    });
    expect(result.next_cursor).toBe('2026-04-24T10:00:00.000Z');
  });

  it('applies default limit of 50 when not provided', async () => {
    groupRepo.findById.mockResolvedValue(buildGroup());
    groupRepo.findMember.mockResolvedValue(buildMember(MemberStatus.ACTIVE));
    messageRepo.listByGroup.mockResolvedValue({ rows: [], nextCursor: null });

    await useCase.execute('user-1', 'group-1');

    expect(messageRepo.listByGroup).toHaveBeenCalledWith(
      'group-1',
      50,
      undefined,
    );
  });

  it('rejects when group does not exist', async () => {
    groupRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('user-1', 'group-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(messageRepo.listByGroup).not.toHaveBeenCalled();
  });

  it('rejects non-members', async () => {
    groupRepo.findById.mockResolvedValue(buildGroup());
    groupRepo.findMember.mockResolvedValue(null);

    await expect(useCase.execute('user-1', 'group-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(messageRepo.listByGroup).not.toHaveBeenCalled();
  });

  it('rejects banned members', async () => {
    groupRepo.findById.mockResolvedValue(buildGroup());
    groupRepo.findMember.mockResolvedValue(buildMember(MemberStatus.BANNED));

    await expect(useCase.execute('user-1', 'group-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
