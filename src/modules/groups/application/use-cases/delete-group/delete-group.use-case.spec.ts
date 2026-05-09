import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AnchorType,
  GroupPrivacy,
  MemberRole,
  MemberStatus,
} from '@localloop/shared-types';
import { Group } from '@domain/entities/group.entity';
import { GroupMember } from '@domain/entities/group-member.entity';
import { DeleteGroupUseCase } from './delete-group.use-case';
import { buildGroupRepoMock } from '@/modules/groups/test/group-repo.mock';

describe('DeleteGroupUseCase', () => {
  let useCase: DeleteGroupUseCase;
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
      3,
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
    useCase = new DeleteGroupUseCase(groupRepo);
  });

  it('throws NotFoundException when the group does not exist', async () => {
    groupRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('user-1', 'group-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(groupRepo.findMember).not.toHaveBeenCalled();
    expect(groupRepo.deleteGroupAtomic).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when caller is not a member', async () => {
    groupRepo.findById.mockResolvedValue(buildGroup());
    groupRepo.findMember.mockResolvedValue(null);

    await expect(useCase.execute('user-1', 'group-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(groupRepo.deleteGroupAtomic).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when caller is a MEMBER (not owner)', async () => {
    groupRepo.findById.mockResolvedValue(buildGroup());
    groupRepo.findMember.mockResolvedValue(buildMember(MemberRole.MEMBER));

    await expect(useCase.execute('user-1', 'group-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(groupRepo.deleteGroupAtomic).not.toHaveBeenCalled();
  });

  it('calls deleteGroupAtomic when caller is the OWNER', async () => {
    groupRepo.findById.mockResolvedValue(buildGroup());
    groupRepo.findMember.mockResolvedValue(buildMember(MemberRole.OWNER));
    groupRepo.deleteGroupAtomic.mockResolvedValue(undefined);

    await useCase.execute('user-1', 'group-1');

    expect(groupRepo.deleteGroupAtomic).toHaveBeenCalledWith('group-1');
  });
});
