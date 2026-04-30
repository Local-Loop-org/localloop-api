import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MemberRole, MemberStatus } from '@localloop/shared-types';
import { GroupMember } from '../../../domain/entities/group-member.entity';
import { IGroupRepository } from '../../../domain/repositories/i-group.repository';
import { BanMemberUseCase } from './ban-member.use-case';

describe('BanMemberUseCase', () => {
  let useCase: BanMemberUseCase;
  let groupRepo: jest.Mocked<IGroupRepository>;

  const buildMember = (
    userId: string,
    role: MemberRole,
    status: MemberStatus = MemberStatus.ACTIVE,
  ): GroupMember =>
    new GroupMember(
      `mem-${userId}`,
      'group-1',
      userId,
      role,
      status,
      new Date('2026-04-23T00:00:00Z'),
    );

  beforeEach(() => {
    groupRepo = buildGroupRepoMock();
    useCase = new BanMemberUseCase(groupRepo);
  });

  it('throws ForbiddenException when caller has no membership', async () => {
    groupRepo.findMember.mockResolvedValueOnce(null);

    await expect(
      useCase.execute('caller-1', 'group-1', 'target-1'),
    ).rejects.toThrow(ForbiddenException);
    expect(groupRepo.findMember).toHaveBeenCalledTimes(1);
    expect(groupRepo.banMemberAtomic).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when caller is a plain MEMBER', async () => {
    groupRepo.findMember.mockResolvedValueOnce(
      buildMember('caller-1', MemberRole.MEMBER),
    );

    await expect(
      useCase.execute('caller-1', 'group-1', 'target-1'),
    ).rejects.toThrow(ForbiddenException);
    expect(groupRepo.banMemberAtomic).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when caller is OWNER but not ACTIVE', async () => {
    groupRepo.findMember.mockResolvedValueOnce(
      buildMember('caller-1', MemberRole.OWNER, MemberStatus.BANNED),
    );

    await expect(
      useCase.execute('caller-1', 'group-1', 'target-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws NotFoundException when the target member does not exist', async () => {
    groupRepo.findMember
      .mockResolvedValueOnce(buildMember('caller-1', MemberRole.OWNER))
      .mockResolvedValueOnce(null);

    await expect(
      useCase.execute('caller-1', 'group-1', 'target-1'),
    ).rejects.toThrow(NotFoundException);
    expect(groupRepo.banMemberAtomic).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when attempting to ban the OWNER', async () => {
    groupRepo.findMember
      .mockResolvedValueOnce(buildMember('caller-1', MemberRole.MODERATOR))
      .mockResolvedValueOnce(buildMember('target-1', MemberRole.OWNER));

    await expect(
      useCase.execute('caller-1', 'group-1', 'target-1'),
    ).rejects.toThrow(ForbiddenException);
    expect(groupRepo.banMemberAtomic).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when a MODERATOR tries to ban another MODERATOR', async () => {
    groupRepo.findMember
      .mockResolvedValueOnce(buildMember('caller-1', MemberRole.MODERATOR))
      .mockResolvedValueOnce(buildMember('target-1', MemberRole.MODERATOR));

    await expect(
      useCase.execute('caller-1', 'group-1', 'target-1'),
    ).rejects.toThrow(ForbiddenException);
    expect(groupRepo.banMemberAtomic).not.toHaveBeenCalled();
  });

  it('bans a plain MEMBER when caller is OWNER', async () => {
    groupRepo.findMember
      .mockResolvedValueOnce(buildMember('caller-1', MemberRole.OWNER))
      .mockResolvedValueOnce(buildMember('target-1', MemberRole.MEMBER));

    await useCase.execute('caller-1', 'group-1', 'target-1');

    expect(groupRepo.banMemberAtomic).toHaveBeenCalledWith(
      'group-1',
      'target-1',
    );
  });

  it('bans a plain MEMBER when caller is MODERATOR', async () => {
    groupRepo.findMember
      .mockResolvedValueOnce(buildMember('caller-1', MemberRole.MODERATOR))
      .mockResolvedValueOnce(buildMember('target-1', MemberRole.MEMBER));

    await useCase.execute('caller-1', 'group-1', 'target-1');

    expect(groupRepo.banMemberAtomic).toHaveBeenCalledWith(
      'group-1',
      'target-1',
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
