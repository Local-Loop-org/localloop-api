import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GroupPrivacy } from '@localloop/shared-types';
import { RADIUS_KM_MAX, RADIUS_KM_MIN } from '@domain/anchor-radius-defaults';

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  anchorLabel?: string;

  @IsOptional()
  @IsEnum(GroupPrivacy)
  privacy?: GroupPrivacy;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(RADIUS_KM_MIN)
  @Max(RADIUS_KM_MAX)
  radiusKm?: number;
}
