import { Inject, Injectable } from '@nestjs/common';
import {
  coordinatesToGeohash,
  getNeighborCells,
  getProximityLabel,
} from '@localloop/geo-utils';
import {
  GROUP_REPOSITORY,
  IGroupRepository,
} from '../../../domain/repositories/i-group.repository';
import {
  DiscoverNearbyGroupsQueryDto,
  DiscoverNearbyGroupsResponseDto,
} from './discover-nearby-groups.dto';

@Injectable()
export class DiscoverNearbyGroupsUseCase {
  constructor(
    @Inject(GROUP_REPOSITORY) private readonly groupRepo: IGroupRepository,
  ) {}

  async execute(
    query: DiscoverNearbyGroupsQueryDto,
  ): Promise<DiscoverNearbyGroupsResponseDto> {
    const userGeohash = coordinatesToGeohash(query.lat, query.lng);
    const cells = [userGeohash, ...getNeighborCells(userGeohash)];
    const groups = await this.groupRepo.findNearby(cells);

    return {
      data: groups.map((g) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        anchorType: g.anchorType,
        anchorLabel: g.anchorLabel,
        proximityLabel: getProximityLabel(userGeohash, g.anchorGeohash),
        privacy: g.privacy,
        memberCount: g.memberCount,
      })),
    };
  }
}
