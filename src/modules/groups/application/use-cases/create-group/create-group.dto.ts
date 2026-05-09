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
import { AnchorType, GroupPrivacy } from '@localloop/shared-types';
import {
  RADIUS_KM_MAX,
  RADIUS_KM_MIN,
} from '../../../domain/anchor-radius-defaults';

export class CreateGroupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsEnum(AnchorType)
  anchorType!: AnchorType;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  anchorLabel!: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @IsEnum(GroupPrivacy)
  privacy!: GroupPrivacy;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(RADIUS_KM_MIN)
  @Max(RADIUS_KM_MAX)
  radiusKm?: number;
}

export class CreateGroupResponseDto {
  id!: string;
  name!: string;
  anchorType!: AnchorType;
  anchorLabel!: string;
  privacy!: GroupPrivacy;
  radiusKm!: number;
  memberCount!: number;
  myRole!: 'owner';
}
