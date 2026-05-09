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
    userId: string,
  ): Promise<DiscoverNearbyGroupsResponseDto> {
    const userRadiusKm = query.radiusKm ?? DEFAULT_DISCOVERY_RADIUS_KM;
    const precision = precisionForRadiusKm(userRadiusKm);
    const userCell = coordinatesToGeohash(query.lat, query.lng, precision);
    const cells = [userCell, ...getNeighborCells(userCell)];

    const rows = await this.groupRepo.findNearby(userId, cells);

    const visible = rows
      .map((r) => ({
        row: r,
        distance: distanceMeters(
          query.lat,
          query.lng,
          r.group.anchorLat,
          r.group.anchorLng,
        ),
      }))
      .filter(({ row, distance }) => {
        const effectiveKm = Math.min(userRadiusKm, row.group.radiusKm);
        return distance <= effectiveKm * 1000;
      });

    return {
      data: visible.map(({ row, distance }) => ({
        id: row.group.id,
        name: row.group.name,
        description: row.group.description,
        anchorType: row.group.anchorType,
        anchorLabel: row.group.anchorLabel,
        distanceMeters: distance,
        privacy: row.group.privacy,
        memberCount: row.group.memberCount,
        radiusKm: row.group.radiusKm,
        myRole: row.myRole,
        memberStatus: row.memberStatus,
      })),
    };
  }
}
