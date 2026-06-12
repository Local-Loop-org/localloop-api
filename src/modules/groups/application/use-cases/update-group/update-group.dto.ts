import {
  IsEnum,
  IsDefined,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GroupPrivacy, MessagePermission } from '@localloop/shared-types';
import { RADIUS_KM_MAX, RADIUS_KM_MIN } from '@domain/anchor-radius-defaults';

const hasCoordinate = (dto: UpdateGroupDto) =>
  dto.lat !== undefined || dto.lng !== undefined;

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
  @MaxLength(100)
  anchorLabel?: string | null;

  @IsOptional()
  @IsEnum(GroupPrivacy)
  privacy?: GroupPrivacy;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(RADIUS_KM_MIN)
  @Max(RADIUS_KM_MAX)
  radiusKm?: number;

  @IsOptional()
  @IsEnum(MessagePermission)
  sendTextPerm?: MessagePermission;

  @IsOptional()
  @IsEnum(MessagePermission)
  sendMediaPerm?: MessagePermission;

  @ValidateIf(hasCoordinate)
  @IsDefined()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ValidateIf(hasCoordinate)
  @IsDefined()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}
