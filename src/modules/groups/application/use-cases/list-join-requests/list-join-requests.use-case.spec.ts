import { ForbiddenException, NotFoundException } from '@nestjs/common';
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
import {
  IGroupRepository,
  JoinRequestWithRequester,
} from '../../../domain/repositories/i-group.repository';
import { ListJoinRequestsUseCase } from './list-join-requests.use-case';

describe('ListJoinRequestsUseCase', () => {
  let useCase: ListJoinRequestsUseCase;
  let groupRepo: jest.Mocked<IGroupRepository>;

  const buildGroup = (): Group =>
    new Group(
      'group-1',
      'Morumbi Runners',
      null,
      AnchorType.NEIGHBORHOOD,
      '6gyf4',
      'Morumbi',
      GroupPrivacy.APPROVAL_REQUIRED,
      'owner-1',
      10,
      true,
      new Date('2026-04-23T00:00:00Z'),
    );

  const buildMember = (
    role: MemberRole,
    status: MemberStatus = MemberStatus.ACTIVE,
  ): GroupMember =>
    new GroupMember(
      'mem-1',
      'group-1',
      'user-1',
      role,
      status,
      new Date('2026-04-23T00:00:00Z'),
    );

  const buildRow = (
    id: string,
    userId: string,
    displayName: string,
    createdAt: Date,
  ): JoinRequestWithRequester => ({
    request: new GroupJoinRequest(
      id,
      'group-1',
      userId,
      RequestStatus.PENDING,
      createdAt,
      null,
      null,
    ),
    requesterDisplayName: displayName,
  });

  beforeEach(() => {
    groupRepo = buildGroupRepoMock();
    useCase = new ListJoinRequestsUseCase(groupRepo);
  });

  it('throws NotFoundException when the group does not exist', async () => {
    groupRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('user-1', 'group-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(groupRepo.findMember).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when caller has no membership', async () => {
    groupRepo.findById.mockResolvedValue(buildGroup());
    groupRepo.findMember.mockResolvedValue(null);

    await expect(useCase.execute('user-1', 'group-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(groupRepo.listJoinRequestsByStatus).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when caller is a plain MEMBER', async () => {
    groupRepo.findById.mockResolvedValue(buildGroup());
    groupRepo.findMember.mockResolvedValue(buildMember(MemberRole.MEMBER));

    await expect(useCase.execute('user-1', 'group-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws ForbiddenException when caller is OWNER but status is not ACTIVE', async () => {
    groupRepo.findById.mockResolvedValue(buildGroup());
    groupRepo.findMember.mockResolvedValue(
      buildMember(MemberRole.OWNER, MemberStatus.PENDING),
    );

    await expect(useCase.execute('user-1', 'group-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('returns pending requests for an OWNER with createdAt serialized to ISO string', async () => {
    groupRepo.findById.mockResolvedValue(buildGroup());
    groupRepo.findMember.mockResolvedValue(buildMember(MemberRole.OWNER));
    const createdAt = new Date('2026-04-22T10:30:00Z');
    groupRepo.listJoinRequestsByStatus.mockResolvedValue([
      buildRow('req-1', 'user-42', 'Bob', createdAt),
    ]);

    const result = await useCase.execute('user-1', 'group-1');

    expect(groupRepo.listJoinRequestsByStatus).toHaveBeenCalledWith(
      'group-1',
      RequestStatus.PENDING,
    );
    expect(result).toEqual({
      data: [
        {
          id: 'req-1',
          userId: 'user-42',
          displayName: 'Bob',
          createdAt: createdAt.toISOString(),
        },
      ],
    });
  });

  it('returns pending requests for a MODERATOR preserving row order', async () => {
    groupRepo.findById.mockResolvedValue(buildGroup());
    groupRepo.findMember.mockResolvedValue(buildMember(MemberRole.MODERATOR));
    groupRepo.listJoinRequestsByStatus.mockResolvedValue([
      buildRow('req-1', 'user-a', 'Alice', new Date('2026-04-22T09:00:00Z')),
      buildRow('req-2', 'user-b', 'Bob', new Date('2026-04-22T10:00:00Z')),
    ]);

    const result = await useCase.execute('user-1', 'group-1');

    expect(result.data.map((r) => r.id)).toEqual(['req-1', 'req-2']);
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
