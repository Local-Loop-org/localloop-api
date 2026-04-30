import { IsNumber, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { NearbyGroup } from '@localloop/shared-types';

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

export type NearbyGroupDto = NearbyGroup;

export class DiscoverNearbyGroupsResponseDto {
  data!: NearbyGroupDto[];
}
