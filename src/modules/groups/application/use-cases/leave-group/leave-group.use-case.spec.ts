import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AnchorType,
  GroupPrivacy,
  MemberRole,
  MemberStatus,
} from '@localloop/shared-types';
import { Group } from '../../../domain/entities/group.entity';
import { GroupMember } from '../../../domain/entities/group-member.entity';
import { IGroupRepository } from '../../../domain/repositories/i-group.repository';
import { LeaveGroupUseCase } from './leave-group.use-case';

describe('LeaveGroupUseCase', () => {
  let useCase: LeaveGroupUseCase;
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

  const buildMember = (role: MemberRole): GroupMember =>
    new GroupMember(
      'mem-1',
      'group-1',
      'user-1',
      role,
      MemberStatus.ACTIVE,
      new Date('2026-04-23T00:00:00Z'),
    );

  beforeEach(() => {
    groupRepo = buildGroupRepoMock();
    useCase = new LeaveGroupUseCase(groupRepo);
  });

  it('throws NotFoundException when the group does not exist', async () => {
    groupRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('user-1', 'group-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(groupRepo.findMember).not.toHaveBeenCalled();
    expect(groupRepo.leaveGroupAtomic).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when caller is not a member', async () => {
    groupRepo.findById.mockResolvedValue(buildGroup());
    groupRepo.findMember.mockResolvedValue(null);

    await expect(useCase.execute('user-1', 'group-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(groupRepo.leaveGroupAtomic).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when caller is the OWNER', async () => {
    groupRepo.findById.mockResolvedValue(buildGroup());
    groupRepo.findMember.mockResolvedValue(buildMember(MemberRole.OWNER));

    await expect(useCase.execute('user-1', 'group-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(groupRepo.leaveGroupAtomic).not.toHaveBeenCalled();
  });

  it('calls leaveGroupAtomic for a regular MEMBER', async () => {
    groupRepo.findById.mockResolvedValue(buildGroup());
    groupRepo.findMember.mockResolvedValue(buildMember(MemberRole.MEMBER));

    await useCase.execute('user-1', 'group-1');

    expect(groupRepo.leaveGroupAtomic).toHaveBeenCalledWith(
      'group-1',
      'user-1',
    );
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
