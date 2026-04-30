import { NotFoundException } from '@nestjs/common';
import {
  AnchorType,
  GroupPrivacy,
  MemberRole,
  MemberStatus,
} from '@localloop/shared-types';
import { Group } from '../../../domain/entities/group.entity';
import { GroupMember } from '../../../domain/entities/group-member.entity';
import { IGroupRepository } from '../../../domain/repositories/i-group.repository';
import { GetGroupDetailUseCase } from './get-group-detail.use-case';

describe('GetGroupDetailUseCase', () => {
  let useCase: GetGroupDetailUseCase;
  let groupRepo: jest.Mocked<IGroupRepository>;

  const buildGroup = (overrides: Partial<Group> = {}): Group => {
    const g = new Group(
      'group-1',
      'Morumbi Runners',
      'Weekly runs',
      AnchorType.NEIGHBORHOOD,
      '6gyf4',
      -23.55,
      -46.63,
      'Morumbi',
      GroupPrivacy.APPROVAL_REQUIRED,
      'owner-1',
      12,
      true,
      new Date('2026-04-23T00:00:00Z'),
    );
    Object.assign(g, overrides);
    return g;
  };

  const buildMember = (role: MemberRole, status: MemberStatus): GroupMember =>
    new GroupMember(
      'mem-1',
      'group-1',
      'user-1',
      role,
      status,
      new Date('2026-04-23T00:00:00Z'),
    );

  beforeEach(() => {
    groupRepo = buildGroupRepoMock();
    useCase = new GetGroupDetailUseCase(groupRepo);
  });

  it('throws NotFoundException when the group does not exist', async () => {
    groupRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('user-1', 'group-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(groupRepo.findMember).not.toHaveBeenCalled();
  });

  it('returns myRole set to the member role when caller is an ACTIVE member', async () => {
    groupRepo.findById.mockResolvedValue(buildGroup());
    groupRepo.findMember.mockResolvedValue(
      buildMember(MemberRole.OWNER, MemberStatus.ACTIVE),
    );

    const result = await useCase.execute('user-1', 'group-1');

    expect(result.myRole).toBe(MemberRole.OWNER);
    expect(result.id).toBe('group-1');
    expect(result.memberCount).toBe(12);
  });

  it('returns myRole null when caller has no membership record', async () => {
    groupRepo.findById.mockResolvedValue(buildGroup());
    groupRepo.findMember.mockResolvedValue(null);

    const result = await useCase.execute('user-1', 'group-1');

    expect(result.myRole).toBeNull();
  });

  it('returns myRole null when caller membership status is PENDING', async () => {
    groupRepo.findById.mockResolvedValue(buildGroup());
    groupRepo.findMember.mockResolvedValue(
      buildMember(MemberRole.MEMBER, MemberStatus.PENDING),
    );

    const result = await useCase.execute('user-1', 'group-1');

    expect(result.myRole).toBeNull();
  });

  it('returns myRole null when caller membership status is BANNED', async () => {
    groupRepo.findById.mockResolvedValue(buildGroup());
    groupRepo.findMember.mockResolvedValue(
      buildMember(MemberRole.MEMBER, MemberStatus.BANNED),
    );

    const result = await useCase.execute('user-1', 'group-1');

    expect(result.myRole).toBeNull();
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
