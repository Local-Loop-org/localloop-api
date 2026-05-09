import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { NearbyGroup } from '@localloop/shared-types';
import {
  RADIUS_KM_MAX,
  RADIUS_KM_MIN,
} from '../../../domain/anchor-radius-defaults';

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

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(RADIUS_KM_MIN)
  @Max(RADIUS_KM_MAX)
  radiusKm?: number;
}

// Extends the shared NearbyGroup with the per-group visibility radius.
// Mobile will pick this up when @localloop/shared-types is bumped.
export interface NearbyGroupDto extends NearbyGroup {
  radiusKm: number;
}

export class DiscoverNearbyGroupsResponseDto {
  data!: NearbyGroupDto[];
}
