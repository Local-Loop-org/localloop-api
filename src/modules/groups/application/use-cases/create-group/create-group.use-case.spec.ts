import { coordinatesToGeohash } from '@localloop/geo-utils';
import { AnchorType, GroupPrivacy } from '@localloop/shared-types';
import { Group } from '../../../domain/entities/group.entity';
import { CreateGroupUseCase } from './create-group.use-case';
import { CreateGroupDto } from './create-group.dto';
import { buildGroupRepoMock } from '../../../test/group-repo.mock';

describe('CreateGroupUseCase', () => {
  let useCase: CreateGroupUseCase;
  let groupRepo: ReturnType<typeof buildGroupRepoMock>;

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
      -23.6,
      -46.7,
      'Morumbi',
      GroupPrivacy.OPEN,
      2,
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

  it('creates a group with the computed geohash and lat/lng, returning owner-shaped response', async () => {
    const dto = buildDto();
    groupRepo.createGroupWithOwner.mockResolvedValue(buildGroup());

    const result = await useCase.execute('user-1', dto);

    const expectedGeohash = coordinatesToGeohash(dto.lat, dto.lng);
    expect(groupRepo.createGroupWithOwner).toHaveBeenCalledWith({
      name: dto.name,
      description: dto.description,
      anchorType: dto.anchorType,
      anchorGeohash: expectedGeohash,
      anchorLat: dto.lat,
      anchorLng: dto.lng,
      anchorLabel: dto.anchorLabel,
      privacy: dto.privacy,
      radiusKm: 2,
      ownerId: 'user-1',
      memberCount: 1,
    });
    expect(result).toEqual({
      id: 'group-1',
      name: 'Morumbi Runners',
      anchorType: AnchorType.NEIGHBORHOOD,
      anchorLabel: 'Morumbi',
      privacy: GroupPrivacy.OPEN,
      radiusKm: 2,
      memberCount: 1,
      myRole: 'owner',
    });
  });

  it('defaults radiusKm from the anchor type when not provided', async () => {
    groupRepo.createGroupWithOwner.mockImplementation(async (data) =>
      buildGroup({ radiusKm: data.radiusKm }),
    );

    await useCase.execute('user-1', buildDto({ anchorType: AnchorType.CONDO }));
    await useCase.execute('user-1', buildDto({ anchorType: AnchorType.CITY }));
    await useCase.execute(
      'user-1',
      buildDto({ anchorType: AnchorType.EVENT }),
    );

    const calls = groupRepo.createGroupWithOwner.mock.calls;
    expect(calls[0][0].radiusKm).toBe(0.1);
    expect(calls[1][0].radiusKm).toBe(50);
    expect(calls[2][0].radiusKm).toBe(0.5);
  });

  it('persists the explicit radiusKm when provided, regardless of anchor type', async () => {
    groupRepo.createGroupWithOwner.mockImplementation(async (data) =>
      buildGroup({ radiusKm: data.radiusKm }),
    );

    await useCase.execute(
      'user-1',
      buildDto({ anchorType: AnchorType.CITY, radiusKm: 3 }),
    );

    expect(groupRepo.createGroupWithOwner.mock.calls[0][0].radiusKm).toBe(3);
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
