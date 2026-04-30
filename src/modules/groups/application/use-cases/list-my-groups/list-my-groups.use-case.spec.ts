import { BadRequestException } from '@nestjs/common';
import { AnchorType, MemberRole } from '@localloop/shared-types';
import {
  IGroupRepository,
  MyGroupRow,
  MyGroupsCursor,
  PaginatedMyGroups,
} from '../../../domain/repositories/i-group.repository';
import { ListMyGroupsUseCase } from './list-my-groups.use-case';

describe('ListMyGroupsUseCase', () => {
  let useCase: ListMyGroupsUseCase;
  let groupRepo: jest.Mocked<IGroupRepository>;

  const buildRow = (overrides: Partial<MyGroupRow> = {}): MyGroupRow => ({
    id: overrides.id ?? 'group-1',
    name: overrides.name ?? 'Morumbi Runners',
    anchorType: overrides.anchorType ?? AnchorType.NEIGHBORHOOD,
    anchorLabel: overrides.anchorLabel ?? 'Morumbi',
    memberCount: overrides.memberCount ?? 12,
    myRole: overrides.myRole ?? MemberRole.MEMBER,
    lastActivityAt:
      overrides.lastActivityAt ?? new Date('2026-04-28T10:00:00Z'),
    lastMessage:
      'lastMessage' in overrides
        ? (overrides.lastMessage ?? null)
        : {
            content: 'Bora correr 7am?',
            senderName: 'Ana',
            createdAt: new Date('2026-04-28T10:00:00Z'),
          },
  });

  beforeEach(() => {
    groupRepo = buildGroupRepoMock();
    useCase = new ListMyGroupsUseCase(groupRepo);
  });

  it('returns empty data and null cursor when the user has no memberships', async () => {
    groupRepo.listMyGroupsByActivity.mockResolvedValue({
      rows: [],
      nextCursor: null,
    });

    const result = await useCase.execute('user-1');

    expect(groupRepo.listMyGroupsByActivity).toHaveBeenCalledWith(
      'user-1',
      20,
      undefined,
    );
    expect(result).toEqual({ data: [], next_cursor: null });
  });

  it('serializes lastMessage and falls back to null for groups with no messages', async () => {
    const withMessages = buildRow({
      id: 'g-active',
      lastActivityAt: new Date('2026-04-28T10:00:00Z'),
      lastMessage: {
        content: 'Quem topa?',
        senderName: 'Ana',
        createdAt: new Date('2026-04-28T10:00:00Z'),
      },
    });
    const noMessages = buildRow({
      id: 'g-quiet',
      lastActivityAt: new Date('2026-04-20T08:00:00Z'),
      lastMessage: null,
    });
    groupRepo.listMyGroupsByActivity.mockResolvedValue({
      rows: [withMessages, noMessages],
      nextCursor: null,
    });

    const result = await useCase.execute('user-1');

    expect(result.data).toEqual([
      {
        id: 'g-active',
        name: withMessages.name,
        anchorType: withMessages.anchorType,
        anchorLabel: withMessages.anchorLabel,
        memberCount: withMessages.memberCount,
        myRole: withMessages.myRole,
        lastActivityAt: '2026-04-28T10:00:00.000Z',
        lastMessage: {
          content: 'Quem topa?',
          senderName: 'Ana',
          createdAt: '2026-04-28T10:00:00.000Z',
        },
      },
      {
        id: 'g-quiet',
        name: noMessages.name,
        anchorType: noMessages.anchorType,
        anchorLabel: noMessages.anchorLabel,
        memberCount: noMessages.memberCount,
        myRole: noMessages.myRole,
        lastActivityAt: '2026-04-20T08:00:00.000Z',
        lastMessage: null,
      },
    ]);
  });

  it('passes through a custom limit', async () => {
    groupRepo.listMyGroupsByActivity.mockResolvedValue({
      rows: [],
      nextCursor: null,
    });

    await useCase.execute('user-1', 5);

    expect(groupRepo.listMyGroupsByActivity).toHaveBeenCalledWith(
      'user-1',
      5,
      undefined,
    );
  });

  it('encodes the next_cursor when the repo returns one', async () => {
    const nextCursor: MyGroupsCursor = {
      lastActivityAt: new Date('2026-04-25T15:30:00Z'),
      groupId: 'group-7',
    };
    const repoResult: PaginatedMyGroups = {
      rows: [buildRow({ id: 'group-7' })],
      nextCursor,
    };
    groupRepo.listMyGroupsByActivity.mockResolvedValue(repoResult);

    const result = await useCase.execute('user-1');

    expect(result.next_cursor).not.toBeNull();
    const decoded = JSON.parse(
      Buffer.from(result.next_cursor as string, 'base64url').toString('utf8'),
    );
    expect(decoded).toEqual({
      lastActivityAt: '2026-04-25T15:30:00.000Z',
      groupId: 'group-7',
    });
  });

  it('decodes a valid cursor and forwards it to the repository', async () => {
    const cursor: MyGroupsCursor = {
      lastActivityAt: new Date('2026-04-22T09:15:00Z'),
      groupId: 'group-3',
    };
    const encoded = Buffer.from(
      JSON.stringify({
        lastActivityAt: cursor.lastActivityAt.toISOString(),
        groupId: cursor.groupId,
      }),
      'utf8',
    ).toString('base64url');
    groupRepo.listMyGroupsByActivity.mockResolvedValue({
      rows: [],
      nextCursor: null,
    });

    await useCase.execute('user-1', 10, encoded);

    expect(groupRepo.listMyGroupsByActivity).toHaveBeenCalledWith(
      'user-1',
      10,
      {
        lastActivityAt: new Date('2026-04-22T09:15:00Z'),
        groupId: 'group-3',
      },
    );
  });

  it('throws BadRequestException for a non-base64 cursor', async () => {
    await expect(useCase.execute('user-1', 10, '!!!not-valid')).rejects.toThrow(
      BadRequestException,
    );
    expect(groupRepo.listMyGroupsByActivity).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when cursor payload is missing fields', async () => {
    const malformed = Buffer.from(
      JSON.stringify({ lastActivityAt: '2026-04-22T09:15:00Z' }),
      'utf8',
    ).toString('base64url');

    await expect(useCase.execute('user-1', 10, malformed)).rejects.toThrow(
      BadRequestException,
    );
    expect(groupRepo.listMyGroupsByActivity).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when cursor lastActivityAt is not parseable', async () => {
    const malformed = Buffer.from(
      JSON.stringify({ lastActivityAt: 'not-a-date', groupId: 'group-3' }),
      'utf8',
    ).toString('base64url');

    await expect(useCase.execute('user-1', 10, malformed)).rejects.toThrow(
      BadRequestException,
    );
    expect(groupRepo.listMyGroupsByActivity).not.toHaveBeenCalled();
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
