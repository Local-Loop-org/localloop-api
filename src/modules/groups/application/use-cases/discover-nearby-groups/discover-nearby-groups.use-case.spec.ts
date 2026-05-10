import { coordinatesToGeohash, getNeighborCells } from '@localloop/geo-utils';
import {
  AnchorType,
  GroupPrivacy,
  MemberRole,
  MemberStatus,
} from '@localloop/shared-types';
import { Group } from '@domain/entities/group.entity';
import { NearbyGroupRow } from '@domain/repositories/i-group.repository';
import { DiscoverNearbyGroupsUseCase } from './discover-nearby-groups.use-case';
import { buildGroupRepoMock } from '@/modules/groups/test/group-repo.mock';

describe('DiscoverNearbyGroupsUseCase', () => {
  let useCase: DiscoverNearbyGroupsUseCase;
  let groupRepo: ReturnType<typeof buildGroupRepoMock>;

  const userLat = -23.55;
  const userLng = -46.63;
  const userId = 'user-abc';

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

  const buildRow = (
    groupOverrides: Partial<Group> = {},
    membership: Pick<NearbyGroupRow, 'myRole' | 'memberStatus'> = {
      myRole: null,
      memberStatus: null,
    },
  ): NearbyGroupRow => ({
    group: buildGroup(groupOverrides),
    ...membership,
  });

  beforeEach(() => {
    groupRepo = buildGroupRepoMock();
    useCase = new DiscoverNearbyGroupsUseCase(groupRepo);
  });

  it('maps groups to DTOs with distanceMeters, radiusKm and forwards metadata', async () => {
    groupRepo.findNearby.mockResolvedValue([buildRow({ radiusKm: 5 })]);

    const result = await useCase.execute(
      { lat: userLat, lng: userLng },
      userId,
    );

    expect(result.data).toHaveLength(1);
    const dto = result.data[0];
    expect(dto.id).toBe('group-1');
    expect(dto.name).toBe('Morumbi Runners');
    expect(dto.description).toBe('Weekly runs');
    expect(dto.anchorType).toBe(AnchorType.NEIGHBORHOOD);
    expect(dto.anchorLabel).toBe('Morumbi');
    expect(dto.privacy).toBe(GroupPrivacy.OPEN);
    expect(dto.memberCount).toBe(5);
    expect(dto.radiusKm).toBe(5);
    expect(typeof dto.distanceMeters).toBe('number');
    expect(dto.distanceMeters).toBeLessThan(1);
    expect(dto.myRole).toBeNull();
    expect(dto.memberStatus).toBeNull();
  });

  it('returns empty data when no groups are found', async () => {
    groupRepo.findNearby.mockResolvedValue([]);

    const result = await useCase.execute(
      { lat: userLat, lng: userLng },
      userId,
    );

    expect(result).toEqual({ data: [] });
  });

  it('uses precision 6 cells for a small (<=2km) radius', async () => {
    groupRepo.findNearby.mockResolvedValue([]);

    await useCase.execute({ lat: userLat, lng: userLng, radiusKm: 1 }, userId);

    const expectedUserCell = coordinatesToGeohash(userLat, userLng, 6);
    const expectedCells = [
      expectedUserCell,
      ...getNeighborCells(expectedUserCell),
    ];
    expect(groupRepo.findNearby).toHaveBeenCalledWith(userId, expectedCells);
    expect(expectedCells[0]).toHaveLength(6);
  });

  it('steps down to precision 5 for a moderate (<=10km) radius', async () => {
    groupRepo.findNearby.mockResolvedValue([]);

    await useCase.execute({ lat: userLat, lng: userLng, radiusKm: 8 }, userId);

    const cells = groupRepo.findNearby.mock.calls[0][1] as string[];
    expect(cells[0]).toHaveLength(5);
    expect(cells).toHaveLength(9);
  });

  it('steps down to precision 4 for a large (>10km) radius and the default 25km', async () => {
    groupRepo.findNearby.mockResolvedValue([]);

    await useCase.execute({ lat: userLat, lng: userLng, radiusKm: 30 }, userId);
    expect((groupRepo.findNearby.mock.calls[0][1] as string[])[0]).toHaveLength(
      4,
    );

    await useCase.execute({ lat: userLat, lng: userLng }, userId);
    expect((groupRepo.findNearby.mock.calls[1][1] as string[])[0]).toHaveLength(
      4,
    );
  });

  it('rejects a group whose visibility radius excludes the caller, even when the user radius is wide', async () => {
    // Group anchor ~1km north of user, but group only visible within 100m.
    groupRepo.findNearby.mockResolvedValue([
      buildRow({
        anchorLat: userLat + 0.009,
        anchorLng: userLng,
        radiusKm: 0.1,
      }),
    ]);

    const result = await useCase.execute(
      { lat: userLat, lng: userLng, radiusKm: 25 },
      userId,
    );

    expect(result.data).toEqual([]);
  });

  it('rejects a group beyond the user radius, even when the group radius is wide', async () => {
    // Group anchor ~5km away, group visibility 50km, but user only wants 1km.
    groupRepo.findNearby.mockResolvedValue([
      buildRow({
        anchorLat: userLat + 0.045,
        anchorLng: userLng,
        radiusKm: 50,
      }),
    ]);

    const result = await useCase.execute(
      { lat: userLat, lng: userLng, radiusKm: 1 },
      userId,
    );

    expect(result.data).toEqual([]);
  });

  it('keeps a group when the caller is within MIN(userRadius, group.radiusKm)', async () => {
    // ~0.5km away; both radii allow it.
    groupRepo.findNearby.mockResolvedValue([
      buildRow({
        anchorLat: userLat + 0.0045,
        anchorLng: userLng,
        radiusKm: 2,
      }),
    ]);

    const result = await useCase.execute(
      { lat: userLat, lng: userLng, radiusKm: 5 },
      userId,
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0].distanceMeters).toBeGreaterThan(400);
    expect(result.data[0].distanceMeters).toBeLessThan(600);
  });

  // --- membership status tests ---

  it('exposes myRole and memberStatus for an active OWNER', async () => {
    groupRepo.findNearby.mockResolvedValue([
      buildRow(
        { radiusKm: 5 },
        { myRole: MemberRole.OWNER, memberStatus: MemberStatus.ACTIVE },
      ),
    ]);

    const result = await useCase.execute(
      { lat: userLat, lng: userLng },
      userId,
    );

    expect(result.data[0].myRole).toBe(MemberRole.OWNER);
    expect(result.data[0].memberStatus).toBe(MemberStatus.ACTIVE);
  });

  it('exposes null myRole and pending memberStatus for a PENDING caller', async () => {
    groupRepo.findNearby.mockResolvedValue([
      buildRow(
        { radiusKm: 5 },
        { myRole: null, memberStatus: MemberStatus.PENDING },
      ),
    ]);

    const result = await useCase.execute(
      { lat: userLat, lng: userLng },
      userId,
    );

    expect(result.data[0].myRole).toBeNull();
    expect(result.data[0].memberStatus).toBe(MemberStatus.PENDING);
  });

  it('exposes null myRole and null memberStatus for a non-member', async () => {
    groupRepo.findNearby.mockResolvedValue([
      buildRow({ radiusKm: 5 }, { myRole: null, memberStatus: null }),
    ]);

    const result = await useCase.execute(
      { lat: userLat, lng: userLng },
      userId,
    );

    expect(result.data[0].myRole).toBeNull();
    expect(result.data[0].memberStatus).toBeNull();
  });

  it('forwards userId as the first argument to the repository', async () => {
    groupRepo.findNearby.mockResolvedValue([]);

    await useCase.execute({ lat: userLat, lng: userLng }, userId);

    expect(groupRepo.findNearby).toHaveBeenCalledWith(
      userId,
      expect.any(Array),
    );
  });
});
