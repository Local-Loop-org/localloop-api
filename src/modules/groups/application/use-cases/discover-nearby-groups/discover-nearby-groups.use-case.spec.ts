import { coordinatesToGeohash, getNeighborCells } from '@localloop/geo-utils';
import { AnchorType, GroupPrivacy } from '@localloop/shared-types';
import { Group } from '../../../domain/entities/group.entity';
import { IGroupRepository } from '../../../domain/repositories/i-group.repository';
import { DiscoverNearbyGroupsUseCase } from './discover-nearby-groups.use-case';

describe('DiscoverNearbyGroupsUseCase', () => {
  let useCase: DiscoverNearbyGroupsUseCase;
  let groupRepo: jest.Mocked<IGroupRepository>;

  const userLat = -23.55;
  const userLng = -46.63;

  const buildGroup = (overrides: Partial<Group> = {}): Group => {
    const g = new Group(
      'group-1',
      'Morumbi Runners',
      'Weekly runs',
      AnchorType.NEIGHBORHOOD,
      coordinatesToGeohash(userLat, userLng),
      userLat,
      userLng,
      'Morumbi',
      GroupPrivacy.OPEN,
      'user-1',
      5,
      true,
      new Date('2026-04-23T00:00:00Z'),
    );
    Object.assign(g, overrides);
    return g;
  };

  beforeEach(() => {
    groupRepo = buildGroupRepoMock();
    useCase = new DiscoverNearbyGroupsUseCase(groupRepo);
  });

  it('maps groups to DTOs with distanceMeters and forwards metadata', async () => {
    const group = buildGroup();
    groupRepo.findNearby.mockResolvedValue([group]);

    const result = await useCase.execute({ lat: userLat, lng: userLng });

    expect(result.data).toHaveLength(1);
    const dto = result.data[0];
    expect(dto.id).toBe(group.id);
    expect(dto.name).toBe(group.name);
    expect(dto.description).toBe(group.description);
    expect(dto.anchorType).toBe(group.anchorType);
    expect(dto.anchorLabel).toBe(group.anchorLabel);
    expect(dto.privacy).toBe(group.privacy);
    expect(dto.memberCount).toBe(group.memberCount);
    expect(typeof dto.distanceMeters).toBe('number');
    // group anchored at user coords → distance is essentially zero
    expect(dto.distanceMeters).toBeLessThan(1);
  });

  it('returns empty data when no groups are found', async () => {
    groupRepo.findNearby.mockResolvedValue([]);

    const result = await useCase.execute({ lat: userLat, lng: userLng });

    expect(result).toEqual({ data: [] });
  });

  it('passes user cell plus 8 neighbor cells to findNearby', async () => {
    groupRepo.findNearby.mockResolvedValue([]);

    await useCase.execute({ lat: userLat, lng: userLng });

    const userGeohash = coordinatesToGeohash(userLat, userLng);
    const expectedCells = [userGeohash, ...getNeighborCells(userGeohash)];
    expect(groupRepo.findNearby).toHaveBeenCalledWith(expectedCells);
    expect(expectedCells).toHaveLength(9);
  });

  it('computes distanceMeters per group against the user coords', async () => {
    const near = buildGroup({ id: 'g-near' });
    const far = buildGroup({
      id: 'g-far',
      anchorLat: 40.7128,
      anchorLng: -74.006,
    });
    groupRepo.findNearby.mockResolvedValue([near, far]);

    const result = await useCase.execute({ lat: userLat, lng: userLng });

    expect(result.data).toHaveLength(2);
    expect(result.data[0].distanceMeters).toBeLessThan(1_000);
    // São Paulo ↔ NYC is ~7,700km
    expect(result.data[1].distanceMeters).toBeGreaterThan(7_500_000);
    expect(result.data[1].distanceMeters).toBeLessThan(8_000_000);
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
