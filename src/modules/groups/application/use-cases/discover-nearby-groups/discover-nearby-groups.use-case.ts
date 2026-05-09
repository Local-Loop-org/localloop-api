import {
  GROUP_REPOSITORY,
  IGroupRepository,
} from '@domain/repositories/i-group.repository';
import {
  coordinatesToGeohash,
  distanceMeters,
  getNeighborCells,
} from '@localloop/geo-utils';
import { Inject, Injectable } from '@nestjs/common';
import {
  DiscoverNearbyGroupsQueryDto,
  DiscoverNearbyGroupsResponseDto,
} from './discover-nearby-groups.dto';
import { DEFAULT_DISCOVERY_RADIUS_KM, precisionForRadiusKm } from './precision';

@Injectable()
export class DiscoverNearbyGroupsUseCase {
  constructor(
    @Inject(GROUP_REPOSITORY) private readonly groupRepo: IGroupRepository,
  ) {}

  async execute(
    query: DiscoverNearbyGroupsQueryDto,
  ): Promise<DiscoverNearbyGroupsResponseDto> {
    const userRadiusKm = query.radiusKm ?? DEFAULT_DISCOVERY_RADIUS_KM;
    const precision = precisionForRadiusKm(userRadiusKm);
    const userCell = coordinatesToGeohash(query.lat, query.lng, precision);
    const cells = [userCell, ...getNeighborCells(userCell)];

    const groups = await this.groupRepo.findNearby(cells);

    const visible = groups
      .map((g) => ({
        group: g,
        distance: distanceMeters(
          query.lat,
          query.lng,
          g.anchorLat,
          g.anchorLng,
        ),
      }))
      .filter(({ group, distance }) => {
        const effectiveKm = Math.min(userRadiusKm, group.radiusKm);
        return distance <= effectiveKm * 1000;
      });

    return {
      data: visible.map(({ group, distance }) => ({
        id: group.id,
        name: group.name,
        description: group.description,
        anchorType: group.anchorType,
        anchorLabel: group.anchorLabel,
        distanceMeters: distance,
        privacy: group.privacy,
        memberCount: group.memberCount,
        radiusKm: group.radiusKm,
      })),
    };
  }
}
