import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MemberRole, MemberStatus } from '@localloop/shared-types';
import { GroupMember } from '@domain/entities/group-member.entity';
import { DemoteMemberUseCase } from './demote-member.use-case';
import { buildGroupRepoMock } from '@/modules/groups/test/group-repo.mock';

describe('DemoteMemberUseCase', () => {
  let useCase: DemoteMemberUseCase;
  let groupRepo: ReturnType<typeof buildGroupRepoMock>;

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
    useCase = new DemoteMemberUseCase(groupRepo);
  });

  it('throws ForbiddenException when caller is a MODERATOR (not OWNER)', async () => {
    groupRepo.findMember.mockResolvedValueOnce(
      buildMember('caller-1', MemberRole.MODERATOR),
    );

    await expect(
      useCase.execute('caller-1', 'group-1', 'target-1'),
    ).rejects.toThrow(ForbiddenException);
    expect(groupRepo.updateMemberRole).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when caller has no membership', async () => {
    groupRepo.findMember.mockResolvedValueOnce(null);

    await expect(
      useCase.execute('caller-1', 'group-1', 'target-1'),
    ).rejects.toThrow(ForbiddenException);
    expect(groupRepo.updateMemberRole).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when caller is OWNER but not ACTIVE', async () => {
    groupRepo.findMember.mockResolvedValueOnce(
      buildMember('caller-1', MemberRole.OWNER, MemberStatus.BANNED),
    );

    await expect(
      useCase.execute('caller-1', 'group-1', 'target-1'),
    ).rejects.toThrow(ForbiddenException);
    expect(groupRepo.updateMemberRole).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the target member does not exist', async () => {
    groupRepo.findMember
      .mockResolvedValueOnce(buildMember('caller-1', MemberRole.OWNER))
      .mockResolvedValueOnce(null);

    await expect(
      useCase.execute('caller-1', 'group-1', 'target-1'),
    ).rejects.toThrow(NotFoundException);
    expect(groupRepo.updateMemberRole).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when target is the OWNER', async () => {
    groupRepo.findMember
      .mockResolvedValueOnce(buildMember('caller-1', MemberRole.OWNER))
      .mockResolvedValueOnce(buildMember('target-1', MemberRole.OWNER));

    await expect(
      useCase.execute('caller-1', 'group-1', 'target-1'),
    ).rejects.toThrow(ForbiddenException);
    expect(groupRepo.updateMemberRole).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when target status is BANNED', async () => {
    groupRepo.findMember
      .mockResolvedValueOnce(buildMember('caller-1', MemberRole.OWNER))
      .mockResolvedValueOnce(
        buildMember('target-1', MemberRole.MODERATOR, MemberStatus.BANNED),
      );

    await expect(
      useCase.execute('caller-1', 'group-1', 'target-1'),
    ).rejects.toThrow(BadRequestException);
    expect(groupRepo.updateMemberRole).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when target status is PENDING', async () => {
    groupRepo.findMember
      .mockResolvedValueOnce(buildMember('caller-1', MemberRole.OWNER))
      .mockResolvedValueOnce(
        buildMember('target-1', MemberRole.MODERATOR, MemberStatus.PENDING),
      );

    await expect(
      useCase.execute('caller-1', 'group-1', 'target-1'),
    ).rejects.toThrow(BadRequestException);
    expect(groupRepo.updateMemberRole).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when target is a regular MEMBER', async () => {
    groupRepo.findMember
      .mockResolvedValueOnce(buildMember('caller-1', MemberRole.OWNER))
      .mockResolvedValueOnce(buildMember('target-1', MemberRole.MEMBER));

    await expect(
      useCase.execute('caller-1', 'group-1', 'target-1'),
    ).rejects.toThrow(BadRequestException);
    expect(groupRepo.updateMemberRole).not.toHaveBeenCalled();
  });

  it('demotes an ACTIVE MODERATOR to MEMBER when caller is OWNER', async () => {
    groupRepo.findMember
      .mockResolvedValueOnce(buildMember('caller-1', MemberRole.OWNER))
      .mockResolvedValueOnce(buildMember('target-1', MemberRole.MODERATOR));

    await useCase.execute('caller-1', 'group-1', 'target-1');

    expect(groupRepo.updateMemberRole).toHaveBeenCalledWith(
      'group-1',
      'target-1',
      MemberRole.MEMBER,
    );
  });
});
