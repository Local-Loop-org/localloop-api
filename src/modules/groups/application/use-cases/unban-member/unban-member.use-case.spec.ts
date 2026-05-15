import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MemberRole, MemberStatus } from '@localloop/shared-types';
import { GroupMember } from '@domain/entities/group-member.entity';
import { UnbanMemberUseCase } from './unban-member.use-case';
import { buildGroupRepoMock } from '@/modules/groups/test/group-repo.mock';

describe('UnbanMemberUseCase', () => {
  let useCase: UnbanMemberUseCase;
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
    useCase = new UnbanMemberUseCase(groupRepo);
  });

  it('throws ForbiddenException when caller has no membership', async () => {
    groupRepo.findMember.mockResolvedValueOnce(null);

    await expect(
      useCase.execute('caller-1', 'group-1', 'target-1'),
    ).rejects.toThrow(ForbiddenException);
    expect(groupRepo.findMember).toHaveBeenCalledTimes(1);
    expect(groupRepo.unbanMemberAtomic).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when caller is a plain MEMBER', async () => {
    groupRepo.findMember.mockResolvedValueOnce(
      buildMember('caller-1', MemberRole.MEMBER),
    );

    await expect(
      useCase.execute('caller-1', 'group-1', 'target-1'),
    ).rejects.toThrow(ForbiddenException);
    expect(groupRepo.unbanMemberAtomic).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when caller is OWNER but not ACTIVE', async () => {
    groupRepo.findMember.mockResolvedValueOnce(
      buildMember('caller-1', MemberRole.OWNER, MemberStatus.BANNED),
    );

    await expect(
      useCase.execute('caller-1', 'group-1', 'target-1'),
    ).rejects.toThrow(ForbiddenException);
    expect(groupRepo.unbanMemberAtomic).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the target member does not exist', async () => {
    groupRepo.findMember
      .mockResolvedValueOnce(buildMember('caller-1', MemberRole.OWNER))
      .mockResolvedValueOnce(null);

    await expect(
      useCase.execute('caller-1', 'group-1', 'target-1'),
    ).rejects.toThrow(NotFoundException);
    expect(groupRepo.unbanMemberAtomic).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when target status is ACTIVE', async () => {
    groupRepo.findMember
      .mockResolvedValueOnce(buildMember('caller-1', MemberRole.OWNER))
      .mockResolvedValueOnce(
        buildMember('target-1', MemberRole.MEMBER, MemberStatus.ACTIVE),
      );

    await expect(
      useCase.execute('caller-1', 'group-1', 'target-1'),
    ).rejects.toThrow(BadRequestException);
    expect(groupRepo.unbanMemberAtomic).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when target status is PENDING', async () => {
    groupRepo.findMember
      .mockResolvedValueOnce(buildMember('caller-1', MemberRole.MODERATOR))
      .mockResolvedValueOnce(
        buildMember('target-1', MemberRole.MEMBER, MemberStatus.PENDING),
      );

    await expect(
      useCase.execute('caller-1', 'group-1', 'target-1'),
    ).rejects.toThrow(BadRequestException);
    expect(groupRepo.unbanMemberAtomic).not.toHaveBeenCalled();
  });

  it('unbans a BANNED member when caller is OWNER', async () => {
    groupRepo.findMember
      .mockResolvedValueOnce(buildMember('caller-1', MemberRole.OWNER))
      .mockResolvedValueOnce(
        buildMember('target-1', MemberRole.MEMBER, MemberStatus.BANNED),
      );

    await useCase.execute('caller-1', 'group-1', 'target-1');

    expect(groupRepo.unbanMemberAtomic).toHaveBeenCalledWith(
      'group-1',
      'target-1',
    );
  });

  it('unbans a BANNED member when caller is MODERATOR', async () => {
    groupRepo.findMember
      .mockResolvedValueOnce(buildMember('caller-1', MemberRole.MODERATOR))
      .mockResolvedValueOnce(
        buildMember('target-1', MemberRole.MEMBER, MemberStatus.BANNED),
      );

    await useCase.execute('caller-1', 'group-1', 'target-1');

    expect(groupRepo.unbanMemberAtomic).toHaveBeenCalledWith(
      'group-1',
      'target-1',
    );
  });
});
