import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { coordinatesToGeohash } from '@localloop/geo-utils';
import {
  AnchorType,
  GroupPrivacy,
  MemberRole,
  MemberStatus,
} from '@localloop/shared-types';
import { Group } from '@domain/entities/group.entity';
import { GroupMember } from '@domain/entities/group-member.entity';

import { UpdateGroupUseCase } from './update-group.use-case';
import { buildGroupRepoMock } from '@/modules/groups/test/group-repo.mock';

describe('UpdateGroupUseCase', () => {
  let useCase: UpdateGroupUseCase;
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

  const group = new Group(
    'group-1',
    'Original Name',
    'Original description',
    AnchorType.ESTABLISHMENT,
    'abc123',
    -23.55,
    -46.63,
    'Original Label',
    GroupPrivacy.OPEN,
    5,
    'owner-1',
    10,
    true,
    new Date('2026-01-01T00:00:00Z'),
  );

  beforeEach(() => {
    groupRepo = buildGroupRepoMock();
    useCase = new UpdateGroupUseCase(groupRepo);
  });

  it('throws NotFoundException when group does not exist', async () => {
    groupRepo.findById.mockResolvedValueOnce(null);

    await expect(
      useCase.execute('caller-1', 'group-1', { name: 'New Name' }),
    ).rejects.toThrow(NotFoundException);
    expect(groupRepo.updateGroup).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when caller has no membership', async () => {
    groupRepo.findById.mockResolvedValueOnce(group);
    groupRepo.findMember.mockResolvedValueOnce(null);

    await expect(
      useCase.execute('caller-1', 'group-1', { name: 'New Name' }),
    ).rejects.toThrow(ForbiddenException);
    expect(groupRepo.updateGroup).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when caller is a plain MEMBER', async () => {
    groupRepo.findById.mockResolvedValueOnce(group);
    groupRepo.findMember.mockResolvedValueOnce(
      buildMember('caller-1', MemberRole.MEMBER),
    );

    await expect(
      useCase.execute('caller-1', 'group-1', { name: 'New Name' }),
    ).rejects.toThrow(ForbiddenException);
    expect(groupRepo.updateGroup).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when caller is OWNER but status is BANNED', async () => {
    groupRepo.findById.mockResolvedValueOnce(group);
    groupRepo.findMember.mockResolvedValueOnce(
      buildMember('caller-1', MemberRole.OWNER, MemberStatus.BANNED),
    );

    await expect(
      useCase.execute('caller-1', 'group-1', { name: 'New Name' }),
    ).rejects.toThrow(ForbiddenException);
    expect(groupRepo.updateGroup).not.toHaveBeenCalled();
  });

  it('allows OWNER to update and returns updated GroupDetailDto', async () => {
    const updatedGroup = new Group(
      'group-1',
      'New Name',
      'Original description',
      AnchorType.ESTABLISHMENT,
      'abc123',
      -23.55,
      -46.63,
      'Original Label',
      GroupPrivacy.OPEN,
      5,
      'owner-1',
      10,
      true,
      new Date('2026-01-01T00:00:00Z'),
    );
    groupRepo.findById.mockResolvedValueOnce(group);
    groupRepo.findMember.mockResolvedValueOnce(
      buildMember('owner-1', MemberRole.OWNER),
    );
    groupRepo.updateGroup.mockResolvedValueOnce(updatedGroup);

    const result = await useCase.execute('owner-1', 'group-1', {
      name: 'New Name',
    });

    expect(groupRepo.updateGroup).toHaveBeenCalledWith('group-1', {
      name: 'New Name',
      description: undefined,
      anchorLabel: undefined,
      privacy: undefined,
      radiusKm: undefined,
    });
    expect(result.name).toBe('New Name');
    expect(result.myRole).toBe(MemberRole.OWNER);
    expect(result.radiusKm).toBe(5);
  });

  it('allows OWNER to relocate the group anchor', async () => {
    const lat = -25.4284;
    const lng = -49.2733;
    const anchorGeohash = coordinatesToGeohash(lat, lng);
    const updatedGroup = new Group(
      'group-1',
      'Original Name',
      'Original description',
      AnchorType.ESTABLISHMENT,
      anchorGeohash,
      lat,
      lng,
      'Original Label',
      GroupPrivacy.OPEN,
      5,
      'owner-1',
      10,
      true,
      new Date('2026-01-01T00:00:00Z'),
    );
    groupRepo.findById.mockResolvedValueOnce(group);
    groupRepo.findMember.mockResolvedValueOnce(
      buildMember('owner-1', MemberRole.OWNER),
    );
    groupRepo.updateGroup.mockResolvedValueOnce(updatedGroup);

    const result = await useCase.execute('owner-1', 'group-1', { lat, lng });

    expect(groupRepo.updateGroup).toHaveBeenCalledWith('group-1', {
      name: undefined,
      description: undefined,
      anchorLabel: undefined,
      privacy: undefined,
      radiusKm: undefined,
      anchorLat: lat,
      anchorLng: lng,
      anchorGeohash,
    });
    expect(result.anchorLat).toBe(lat);
    expect(result.anchorLng).toBe(lng);
  });

  it('allows MODERATOR to update and returns updated GroupDetailDto', async () => {
    const updatedGroup = new Group(
      'group-1',
      'Original Name',
      null,
      AnchorType.ESTABLISHMENT,
      'abc123',
      -23.55,
      -46.63,
      'Original Label',
      GroupPrivacy.APPROVAL_REQUIRED,
      5,
      'owner-1',
      10,
      true,
      new Date('2026-01-01T00:00:00Z'),
    );
    groupRepo.findById.mockResolvedValueOnce(group);
    groupRepo.findMember.mockResolvedValueOnce(
      buildMember('mod-1', MemberRole.MODERATOR),
    );
    groupRepo.updateGroup.mockResolvedValueOnce(updatedGroup);

    const result = await useCase.execute('mod-1', 'group-1', {
      description: null,
      privacy: GroupPrivacy.APPROVAL_REQUIRED,
    });

    expect(groupRepo.updateGroup).toHaveBeenCalledWith('group-1', {
      name: undefined,
      description: null,
      anchorLabel: undefined,
      privacy: GroupPrivacy.APPROVAL_REQUIRED,
      radiusKm: undefined,
    });
    expect(result.privacy).toBe(GroupPrivacy.APPROVAL_REQUIRED);
    expect(result.description).toBeNull();
    expect(result.myRole).toBe(MemberRole.MODERATOR);
  });

  it('allows a privileged member to clear the anchor label', async () => {
    const updatedGroup = new Group(
      'group-1',
      'Original Name',
      'Original description',
      AnchorType.ESTABLISHMENT,
      'abc123',
      -23.55,
      -46.63,
      null,
      GroupPrivacy.OPEN,
      5,
      'owner-1',
      10,
      true,
      new Date('2026-01-01T00:00:00Z'),
    );
    groupRepo.findById.mockResolvedValueOnce(group);
    groupRepo.findMember.mockResolvedValueOnce(
      buildMember('owner-1', MemberRole.OWNER),
    );
    groupRepo.updateGroup.mockResolvedValueOnce(updatedGroup);

    const result = await useCase.execute('owner-1', 'group-1', {
      anchorLabel: null,
    });

    expect(groupRepo.updateGroup).toHaveBeenCalledWith('group-1', {
      name: undefined,
      description: undefined,
      anchorLabel: null,
      privacy: undefined,
      radiusKm: undefined,
    });
    expect(result.anchorLabel).toBeNull();
  });

  it('passes only the provided fields to updateGroup', async () => {
    groupRepo.findById.mockResolvedValueOnce(group);
    groupRepo.findMember.mockResolvedValueOnce(
      buildMember('owner-1', MemberRole.OWNER),
    );
    groupRepo.updateGroup.mockResolvedValueOnce(group);

    await useCase.execute('owner-1', 'group-1', { radiusKm: 20 });

    expect(groupRepo.updateGroup).toHaveBeenCalledWith('group-1', {
      name: undefined,
      description: undefined,
      anchorLabel: undefined,
      privacy: undefined,
      radiusKm: 20,
    });
  });
});
