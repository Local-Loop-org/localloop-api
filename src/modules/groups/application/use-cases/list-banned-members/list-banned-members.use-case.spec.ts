import {
  AnchorType,
  GroupPrivacy,
  MemberRole,
  MemberStatus,
} from '@localloop/shared-types';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GroupMember } from '@domain/entities/group-member.entity';
import { Group } from '@domain/entities/group.entity';
import { MemberRow } from '@domain/repositories/i-group.repository';
import { buildGroupRepoMock } from '@/modules/groups/test/group-repo.mock';
import { ListBannedMembersUseCase } from './list-banned-members.use-case';

describe('ListBannedMembersUseCase', () => {
  let useCase: ListBannedMembersUseCase;
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
      10,
      true,
      new Date('2026-04-23T00:00:00Z'),
    );

  const buildCaller = (
    role: MemberRole,
    status: MemberStatus = MemberStatus.ACTIVE,
  ): GroupMember =>
    new GroupMember(
      'mem-caller',
      'group-1',
      'caller-1',
      role,
      status,
      new Date('2026-04-23T00:00:00Z'),
    );

  const buildRow = (userId: string): MemberRow => ({
    userId,
    displayName: `User ${userId}`,
    avatarUrl: null,
    role: MemberRole.MEMBER,
    joinedAt: new Date('2026-04-22T00:00:00Z'),
  });

  beforeEach(() => {
    groupRepo = buildGroupRepoMock();
    useCase = new ListBannedMembersUseCase(groupRepo);
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

  it('throws ForbiddenException when caller is a plain MEMBER', async () => {
    groupRepo.findById.mockResolvedValue(buildGroup());
    groupRepo.findMember.mockResolvedValue(buildCaller(MemberRole.MEMBER));

    await expect(useCase.execute('caller-1', 'group-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(groupRepo.listMembersPaginated).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when caller is OWNER but not ACTIVE', async () => {
    groupRepo.findById.mockResolvedValue(buildGroup());
    groupRepo.findMember.mockResolvedValue(
      buildCaller(MemberRole.OWNER, MemberStatus.BANNED),
    );

    await expect(useCase.execute('caller-1', 'group-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(groupRepo.listMembersPaginated).not.toHaveBeenCalled();
  });

  it('defaults limit to 50, queries BANNED status, and maps rows to DTO shape when caller is OWNER', async () => {
    groupRepo.findById.mockResolvedValue(buildGroup());
    groupRepo.findMember.mockResolvedValue(buildCaller(MemberRole.OWNER));
    groupRepo.listMembersPaginated.mockResolvedValue({
      rows: [buildRow('user-a'), buildRow('user-b')],
      nextCursor: null,
    });

    const result = await useCase.execute('caller-1', 'group-1');

    expect(groupRepo.listMembersPaginated).toHaveBeenCalledWith(
      'group-1',
      50,
      undefined,
      MemberStatus.BANNED,
    );
    expect(result).toEqual({
      data: [
        {
          userId: 'user-a',
          displayName: 'User user-a',
          avatarUrl: null,
          role: MemberRole.MEMBER,
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

  it('passes through custom limit and cursor and surfaces next_cursor when caller is MODERATOR', async () => {
    groupRepo.findById.mockResolvedValue(buildGroup());
    groupRepo.findMember.mockResolvedValue(buildCaller(MemberRole.MODERATOR));
    groupRepo.listMembersPaginated.mockResolvedValue({
      rows: [buildRow('user-c')],
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
      MemberStatus.BANNED,
    );
    expect(result.next_cursor).toBe('cursor-abc');
  });

  it('returns an empty list when there are no banned members', async () => {
    groupRepo.findById.mockResolvedValue(buildGroup());
    groupRepo.findMember.mockResolvedValue(buildCaller(MemberRole.OWNER));
    groupRepo.listMembersPaginated.mockResolvedValue({
      rows: [],
      nextCursor: null,
    });

    const result = await useCase.execute('caller-1', 'group-1');

    expect(result).toEqual({ data: [], next_cursor: null });
  });
});
