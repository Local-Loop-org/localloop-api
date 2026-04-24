import {
  ConflictException,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import {
  AnchorType,
  GroupPrivacy,
  MemberRole,
  MemberStatus,
  RequestStatus,
} from '@localloop/shared-types';
import { Group } from '../../../domain/entities/group.entity';
import { GroupMember } from '../../../domain/entities/group-member.entity';
import { GroupJoinRequest } from '../../../domain/entities/group-join-request.entity';
import { IGroupRepository } from '../../../domain/repositories/i-group.repository';
import { JoinGroupUseCase } from './join-group.use-case';

describe('JoinGroupUseCase', () => {
  let useCase: JoinGroupUseCase;
  let groupRepo: jest.Mocked<IGroupRepository>;

  const buildGroup = (
    privacy: GroupPrivacy,
    overrides: Partial<Group> = {},
  ): Group => {
    const g = new Group(
      'group-1',
      'Morumbi Runners',
      null,
      AnchorType.NEIGHBORHOOD,
      '6gyf4',
      'Morumbi',
      privacy,
      'owner-1',
      10,
      true,
      new Date('2026-04-23T00:00:00Z'),
    );
    Object.assign(g, overrides);
    return g;
  };

  const buildMember = (status: MemberStatus): GroupMember =>
    new GroupMember(
      'mem-1',
      'group-1',
      'user-1',
      MemberRole.MEMBER,
      status,
      new Date('2026-04-23T00:00:00Z'),
    );

  const buildPendingRequest = (): GroupJoinRequest =>
    new GroupJoinRequest(
      'req-1',
      'group-1',
      'user-1',
      RequestStatus.PENDING,
      new Date('2026-04-23T00:00:00Z'),
      null,
      null,
    );

  beforeEach(() => {
    groupRepo = buildGroupRepoMock();
    useCase = new JoinGroupUseCase(groupRepo);
  });

  it('throws NotFoundException when the group does not exist', async () => {
    groupRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('user-1', 'group-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(groupRepo.findMember).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the group is inactive', async () => {
    groupRepo.findById.mockResolvedValue(
      buildGroup(GroupPrivacy.OPEN, { isActive: false }),
    );

    await expect(useCase.execute('user-1', 'group-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws ForbiddenException when the caller is BANNED', async () => {
    groupRepo.findById.mockResolvedValue(buildGroup(GroupPrivacy.OPEN));
    groupRepo.findMember.mockResolvedValue(buildMember(MemberStatus.BANNED));

    await expect(useCase.execute('user-1', 'group-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(groupRepo.addMember).not.toHaveBeenCalled();
    expect(groupRepo.createJoinRequest).not.toHaveBeenCalled();
  });

  it('throws ConflictException when the caller is already an ACTIVE member', async () => {
    groupRepo.findById.mockResolvedValue(buildGroup(GroupPrivacy.OPEN));
    groupRepo.findMember.mockResolvedValue(buildMember(MemberStatus.ACTIVE));

    await expect(useCase.execute('user-1', 'group-1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('adds the member and increments count for OPEN groups, returning status=joined', async () => {
    groupRepo.findById.mockResolvedValue(buildGroup(GroupPrivacy.OPEN));
    groupRepo.findMember.mockResolvedValue(null);

    const result = await useCase.execute('user-1', 'group-1');

    expect(groupRepo.addMember).toHaveBeenCalledWith(
      'group-1',
      'user-1',
      MemberRole.MEMBER,
      MemberStatus.ACTIVE,
    );
    expect(groupRepo.incrementMemberCount).toHaveBeenCalledWith('group-1');
    expect(result.status).toBe(HttpStatus.OK);
    expect(result.body).toEqual({ status: 'joined', role: 'member' });
  });

  it('creates a pending join request for APPROVAL_REQUIRED groups when none exists', async () => {
    groupRepo.findById.mockResolvedValue(
      buildGroup(GroupPrivacy.APPROVAL_REQUIRED),
    );
    groupRepo.findMember.mockResolvedValue(null);
    groupRepo.findPendingJoinRequest.mockResolvedValue(null);

    const result = await useCase.execute('user-1', 'group-1');

    expect(groupRepo.createJoinRequest).toHaveBeenCalledWith(
      'group-1',
      'user-1',
      RequestStatus.PENDING,
    );
    expect(groupRepo.addMember).not.toHaveBeenCalled();
    expect(groupRepo.incrementMemberCount).not.toHaveBeenCalled();
    expect(result.status).toBe(HttpStatus.ACCEPTED);
    expect(result.body).toEqual({ status: 'pending' });
  });

  it('is idempotent when a pending join request already exists (APPROVAL_REQUIRED)', async () => {
    groupRepo.findById.mockResolvedValue(
      buildGroup(GroupPrivacy.APPROVAL_REQUIRED),
    );
    groupRepo.findMember.mockResolvedValue(null);
    groupRepo.findPendingJoinRequest.mockResolvedValue(buildPendingRequest());

    const result = await useCase.execute('user-1', 'group-1');

    expect(groupRepo.createJoinRequest).not.toHaveBeenCalled();
    expect(result.status).toBe(HttpStatus.ACCEPTED);
    expect(result.body).toEqual({ status: 'pending' });
  });

  it('falls through to privacy handling when caller has PENDING membership status', async () => {
    groupRepo.findById.mockResolvedValue(
      buildGroup(GroupPrivacy.APPROVAL_REQUIRED),
    );
    groupRepo.findMember.mockResolvedValue(buildMember(MemberStatus.PENDING));
    groupRepo.findPendingJoinRequest.mockResolvedValue(null);

    const result = await useCase.execute('user-1', 'group-1');

    expect(groupRepo.createJoinRequest).toHaveBeenCalledWith(
      'group-1',
      'user-1',
      RequestStatus.PENDING,
    );
    expect(result.body).toEqual({ status: 'pending' });
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
  };
}
