import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AnchorType,
  GroupPrivacy,
  MemberRole,
  MemberStatus,
} from '@localloop/shared-types';
import { Group } from '../../../domain/entities/group.entity';
import { GroupMember } from '../../../domain/entities/group-member.entity';
import {
  IGroupRepository,
  MemberRow,
} from '../../../domain/repositories/i-group.repository';
import { ListGroupMembersUseCase } from './list-group-members.use-case';

describe('ListGroupMembersUseCase', () => {
  let useCase: ListGroupMembersUseCase;
  let groupRepo: jest.Mocked<IGroupRepository>;

  const buildGroup = (): Group =>
    new Group(
      'group-1',
      'Morumbi Runners',
      null,
      AnchorType.NEIGHBORHOOD,
      '6gyf4',
      'Morumbi',
      GroupPrivacy.OPEN,
      'owner-1',
      10,
      true,
      new Date('2026-04-23T00:00:00Z'),
    );

  const buildCaller = (status: MemberStatus): GroupMember =>
    new GroupMember(
      'mem-caller',
      'group-1',
      'caller-1',
      MemberRole.MEMBER,
      status,
      new Date('2026-04-23T00:00:00Z'),
    );

  const buildRow = (userId: string, role: MemberRole): MemberRow => ({
    userId,
    displayName: `User ${userId}`,
    avatarUrl: null,
    role,
    joinedAt: new Date('2026-04-22T00:00:00Z'),
  });

  beforeEach(() => {
    groupRepo = buildGroupRepoMock();
    useCase = new ListGroupMembersUseCase(groupRepo);
  });

  it('throws NotFoundException when the group does not exist', async () => {
    groupRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('caller-1', 'group-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(groupRepo.findMember).not.toHaveBeenCalled();
    expect(groupRepo.listMembersPaginated).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when caller has no membership', async () => {
    groupRepo.findById.mockResolvedValue(buildGroup());
    groupRepo.findMember.mockResolvedValue(null);

    await expect(useCase.execute('caller-1', 'group-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(groupRepo.listMembersPaginated).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when caller membership is PENDING', async () => {
    groupRepo.findById.mockResolvedValue(buildGroup());
    groupRepo.findMember.mockResolvedValue(buildCaller(MemberStatus.PENDING));

    await expect(useCase.execute('caller-1', 'group-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(groupRepo.listMembersPaginated).not.toHaveBeenCalled();
  });

  it('defaults limit to 50 when not provided and maps rows to DTO shape', async () => {
    groupRepo.findById.mockResolvedValue(buildGroup());
    groupRepo.findMember.mockResolvedValue(buildCaller(MemberStatus.ACTIVE));
    groupRepo.listMembersPaginated.mockResolvedValue({
      rows: [
        buildRow('user-a', MemberRole.OWNER),
        buildRow('user-b', MemberRole.MEMBER),
      ],
      nextCursor: null,
    });

    const result = await useCase.execute('caller-1', 'group-1');

    expect(groupRepo.listMembersPaginated).toHaveBeenCalledWith(
      'group-1',
      50,
      undefined,
    );
    expect(result).toEqual({
      data: [
        {
          userId: 'user-a',
          displayName: 'User user-a',
          avatarUrl: null,
          role: MemberRole.OWNER,
        },
        {
          userId: 'user-b',
          displayName: 'User user-b',
          avatarUrl: null,
          role: MemberRole.MEMBER,
        },
      ],
      next_cursor: null,
    });
  });

  it('passes through custom limit and cursor and surfaces next_cursor in the response', async () => {
    groupRepo.findById.mockResolvedValue(buildGroup());
    groupRepo.findMember.mockResolvedValue(buildCaller(MemberStatus.ACTIVE));
    groupRepo.listMembersPaginated.mockResolvedValue({
      rows: [buildRow('user-c', MemberRole.MEMBER)],
      nextCursor: 'cursor-abc',
    });

    const result = await useCase.execute(
      'caller-1',
      'group-1',
      25,
      'cursor-prev',
    );

    expect(groupRepo.listMembersPaginated).toHaveBeenCalledWith(
      'group-1',
      25,
      'cursor-prev',
    );
    expect(result.next_cursor).toBe('cursor-abc');
  });
});

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
