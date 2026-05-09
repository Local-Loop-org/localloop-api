import { coordinatesToGeohash, getNeighborCells } from '@localloop/geo-utils';
import { AnchorType, GroupPrivacy } from '@localloop/shared-types';
import { Group } from '@domain/entities/group.entity';
import { DiscoverNearbyGroupsUseCase } from './discover-nearby-groups.use-case';
import { buildGroupRepoMock } from '@/modules/groups/test/group-repo.mock';

describe('DiscoverNearbyGroupsUseCase', () => {
  let useCase: DiscoverNearbyGroupsUseCase;
  let groupRepo: ReturnType<typeof buildGroupRepoMock>;

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
      50,
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

  it('maps groups to DTOs with distanceMeters, radiusKm and forwards metadata', async () => {
    const group = buildGroup({ radiusKm: 5 });
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
    expect(dto.radiusKm).toBe(5);
    expect(typeof dto.distanceMeters).toBe('number');
    expect(dto.distanceMeters).toBeLessThan(1);
  });

  it('returns empty data when no groups are found', async () => {
    groupRepo.findNearby.mockResolvedValue([]);

    const result = await useCase.execute({ lat: userLat, lng: userLng });

    expect(result).toEqual({ data: [] });
  });

  it('uses precision 6 cells for a small (<=2km) radius', async () => {
    groupRepo.findNearby.mockResolvedValue([]);

    await useCase.execute({ lat: userLat, lng: userLng, radiusKm: 1 });

    const expectedUserCell = coordinatesToGeohash(userLat, userLng, 6);
    const expectedCells = [
      expectedUserCell,
      ...getNeighborCells(expectedUserCell),
    ];
    expect(groupRepo.findNearby).toHaveBeenCalledWith(expectedCells);
    expect(expectedCells[0]).toHaveLength(6);
  });

  it('steps down to precision 5 for a moderate (<=10km) radius', async () => {
    groupRepo.findNearby.mockResolvedValue([]);

    await useCase.execute({ lat: userLat, lng: userLng, radiusKm: 8 });

    const cells = groupRepo.findNearby.mock.calls[0][0];
    expect(cells[0]).toHaveLength(5);
    expect(cells).toHaveLength(9);
  });

  it('steps down to precision 4 for a large (>10km) radius and the default 25km', async () => {
    groupRepo.findNearby.mockResolvedValue([]);

    await useCase.execute({ lat: userLat, lng: userLng, radiusKm: 30 });
    expect(groupRepo.findNearby.mock.calls[0][0][0]).toHaveLength(4);

    await useCase.execute({ lat: userLat, lng: userLng });
    expect(groupRepo.findNearby.mock.calls[1][0][0]).toHaveLength(4);
  });

  it('rejects a group whose visibility radius excludes the caller, even when the user radius is wide', async () => {
    // Group anchor ~1km north of user, but group only visible within 100m.
    const group = buildGroup({
      anchorLat: userLat + 0.009,
      anchorLng: userLng,
      radiusKm: 0.1,
    });
    groupRepo.findNearby.mockResolvedValue([group]);

    const result = await useCase.execute({
      lat: userLat,
      lng: userLng,
      radiusKm: 25,
    });

    expect(result.data).toEqual([]);
  });

  it('rejects a group beyond the user radius, even when the group radius is wide', async () => {
    // Group anchor ~5km away, group visibility 50km, but user only wants 1km.
    const group = buildGroup({
      anchorLat: userLat + 0.045,
      anchorLng: userLng,
      radiusKm: 50,
    });
    groupRepo.findNearby.mockResolvedValue([group]);

    const result = await useCase.execute({
      lat: userLat,
      lng: userLng,
      radiusKm: 1,
    });

    expect(result.data).toEqual([]);
  });

  it('keeps a group when the caller is within MIN(userRadius, group.radiusKm)', async () => {
    // ~0.5km away; both radii allow it.
    const group = buildGroup({
      anchorLat: userLat + 0.0045,
      anchorLng: userLng,
      radiusKm: 2,
    });
    groupRepo.findNearby.mockResolvedValue([group]);

    const result = await useCase.execute({
      lat: userLat,
      lng: userLng,
      radiusKm: 5,
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].distanceMeters).toBeGreaterThan(400);
    expect(result.data[0].distanceMeters).toBeLessThan(600);
  });
});
