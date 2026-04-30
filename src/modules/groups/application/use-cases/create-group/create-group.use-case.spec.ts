import { coordinatesToGeohash } from '@localloop/geo-utils';
import { AnchorType, GroupPrivacy } from '@localloop/shared-types';
import { Group } from '../../../domain/entities/group.entity';
import { IGroupRepository } from '../../../domain/repositories/i-group.repository';
import { CreateGroupUseCase } from './create-group.use-case';
import { CreateGroupDto } from './create-group.dto';

describe('CreateGroupUseCase', () => {
  let useCase: CreateGroupUseCase;
  let groupRepo: jest.Mocked<IGroupRepository>;

  const buildDto = (overrides: Partial<CreateGroupDto> = {}): CreateGroupDto =>
    ({
      name: 'Morumbi Runners',
      description: 'Weekly runs in Morumbi',
      anchorType: AnchorType.NEIGHBORHOOD,
      anchorLabel: 'Morumbi',
      lat: -23.6,
      lng: -46.7,
      privacy: GroupPrivacy.OPEN,
      ...overrides,
    }) as CreateGroupDto;

  const buildGroup = (overrides: Partial<Group> = {}): Group => {
    const g = new Group(
      'group-1',
      'Morumbi Runners',
      'Weekly runs in Morumbi',
      AnchorType.NEIGHBORHOOD,
      coordinatesToGeohash(-23.6, -46.7),
      'Morumbi',
      GroupPrivacy.OPEN,
      'user-1',
      1,
      true,
      new Date('2026-04-23T00:00:00Z'),
    );
    Object.assign(g, overrides);
    return g;
  };

  beforeEach(() => {
    groupRepo = buildGroupRepoMock();
    useCase = new CreateGroupUseCase(groupRepo);
  });

  it('creates a group with the computed geohash and returns owner-shaped response', async () => {
    const dto = buildDto();
    groupRepo.createGroupWithOwner.mockResolvedValue(buildGroup());

    const result = await useCase.execute('user-1', dto);

    const expectedGeohash = coordinatesToGeohash(dto.lat, dto.lng);
    expect(groupRepo.createGroupWithOwner).toHaveBeenCalledWith({
      name: dto.name,
      description: dto.description,
      anchorType: dto.anchorType,
      anchorGeohash: expectedGeohash,
      anchorLabel: dto.anchorLabel,
      privacy: dto.privacy,
      ownerId: 'user-1',
      memberCount: 1,
    });
    expect(result).toEqual({
      id: 'group-1',
      name: 'Morumbi Runners',
      anchorType: AnchorType.NEIGHBORHOOD,
      anchorLabel: 'Morumbi',
      privacy: GroupPrivacy.OPEN,
      memberCount: 1,
      myRole: 'owner',
    });
  });

  it('produces distinct geohashes for distant coordinates', async () => {
    groupRepo.createGroupWithOwner.mockImplementation(async (data) =>
      buildGroup({ anchorGeohash: data.anchorGeohash }),
    );

    await useCase.execute('user-1', buildDto({ lat: -23.55, lng: -46.63 }));
    await useCase.execute('user-1', buildDto({ lat: 40.7128, lng: -74.006 }));

    const first = groupRepo.createGroupWithOwner.mock.calls[0][0].anchorGeohash;
    const second =
      groupRepo.createGroupWithOwner.mock.calls[1][0].anchorGeohash;
    expect(first).not.toEqual(second);
  });

  it('stores null when description is omitted', async () => {
    const dto = buildDto();
    delete (dto as Partial<CreateGroupDto>).description;
    groupRepo.createGroupWithOwner.mockResolvedValue(
      buildGroup({ description: null }),
    );

    await useCase.execute('user-1', dto);

    expect(groupRepo.createGroupWithOwner.mock.calls[0][0].description).toBe(
      null,
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
