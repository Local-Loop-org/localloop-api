import { IsNumber, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AnchorType, GroupPrivacy } from '@localloop/shared-types';
import type { ProximityLabelValue } from '@localloop/geo-utils';

export class DiscoverNearbyGroupsQueryDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;
}

export class NearbyGroupDto {
  id!: string;
  name!: string;
  description!: string | null;
  anchorType!: AnchorType;
  anchorLabel!: string;
  proximityLabel!: ProximityLabelValue;
  privacy!: GroupPrivacy;
  memberCount!: number;
}

export class DiscoverNearbyGroupsResponseDto {
  data!: NearbyGroupDto[];
}
