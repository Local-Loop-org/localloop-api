import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  MemberRole,
  MemberStatus,
  RequestStatus,
} from '@localloop/shared-types';
import { GroupMember } from '../../../domain/entities/group-member.entity';
import { GroupJoinRequest } from '../../../domain/entities/group-join-request.entity';
import { IGroupRepository } from '../../../domain/repositories/i-group.repository';
import { ResolveJoinRequestUseCase } from './resolve-join-request.use-case';

describe('ResolveJoinRequestUseCase', () => {
  let useCase: ResolveJoinRequestUseCase;
  let groupRepo: jest.Mocked<IGroupRepository>;

  const buildMember = (role: MemberRole): GroupMember =>
    new GroupMember(
      'mem-caller',
      'group-1',
      'caller-1',
      role,
      MemberStatus.ACTIVE,
      new Date('2026-04-23T00:00:00Z'),
    );

  const buildRequest = (status: RequestStatus): GroupJoinRequest =>
    new GroupJoinRequest(
      'req-1',
      'group-1',
      'requester-1',
      status,
      new Date('2026-04-22T00:00:00Z'),
      null,
      null,
    );

  beforeEach(() => {
    groupRepo = buildGroupRepoMock();
    useCase = new ResolveJoinRequestUseCase(groupRepo);
  });

  it('throws ForbiddenException when caller is not a privileged ACTIVE member', async () => {
    groupRepo.findMember.mockResolvedValue(buildMember(MemberRole.MEMBER));

    await expect(
      useCase.execute('caller-1', 'group-1', 'req-1', 'approve'),
    ).rejects.toThrow(ForbiddenException);
    expect(groupRepo.findJoinRequestById).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the request does not exist', async () => {
    groupRepo.findMember.mockResolvedValue(buildMember(MemberRole.OWNER));
    groupRepo.findJoinRequestById.mockResolvedValue(null);

    await expect(
      useCase.execute('caller-1', 'group-1', 'req-1', 'approve'),
    ).rejects.toThrow(NotFoundException);
    expect(groupRepo.approveJoinRequestAtomic).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the request status is not PENDING', async () => {
    groupRepo.findMember.mockResolvedValue(buildMember(MemberRole.OWNER));
    groupRepo.findJoinRequestById.mockResolvedValue(
      buildRequest(RequestStatus.APPROVED),
    );

    await expect(
      useCase.execute('caller-1', 'group-1', 'req-1', 'approve'),
    ).rejects.toThrow(NotFoundException);
  });

  it('calls approveJoinRequestAtomic and returns status=approved on approve action', async () => {
    groupRepo.findMember.mockResolvedValue(buildMember(MemberRole.MODERATOR));
    groupRepo.findJoinRequestById.mockResolvedValue(
      buildRequest(RequestStatus.PENDING),
    );

    const result = await useCase.execute(
      'caller-1',
      'group-1',
      'req-1',
      'approve',
    );

    expect(groupRepo.approveJoinRequestAtomic).toHaveBeenCalledTimes(1);
    const params = groupRepo.approveJoinRequestAtomic.mock.calls[0][0];
    expect(params).toMatchObject({
      requestId: 'req-1',
      groupId: 'group-1',
      userId: 'requester-1',
      resolverId: 'caller-1',
    });
    expect(params.resolvedAt).toBeInstanceOf(Date);
    expect(groupRepo.updateJoinRequestStatus).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'approved' });
  });

  it('calls updateJoinRequestStatus with REJECTED and returns status=rejected on reject action', async () => {
    groupRepo.findMember.mockResolvedValue(buildMember(MemberRole.OWNER));
    groupRepo.findJoinRequestById.mockResolvedValue(
      buildRequest(RequestStatus.PENDING),
    );

    const result = await useCase.execute(
      'caller-1',
      'group-1',
      'req-1',
      'reject',
    );

    expect(groupRepo.updateJoinRequestStatus).toHaveBeenCalledTimes(1);
    const [requestId, status, resolvedAt, resolvedBy] =
      groupRepo.updateJoinRequestStatus.mock.calls[0];
    expect(requestId).toBe('req-1');
    expect(status).toBe(RequestStatus.REJECTED);
    expect(resolvedAt).toBeInstanceOf(Date);
    expect(resolvedBy).toBe('caller-1');
    expect(groupRepo.approveJoinRequestAtomic).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'rejected' });
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
