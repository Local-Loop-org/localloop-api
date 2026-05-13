import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import {
  DevicePlatform,
  PushProvider,
} from '@localloop/shared-types';

export class RegisterCurrentPushDeviceDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  installationId!: string;

  @IsEnum(PushProvider)
  provider!: PushProvider;

  @IsEnum(DevicePlatform)
  platform!: DevicePlatform;

  @IsString()
  @MinLength(8)
  @MaxLength(4096)
  token!: string;
}

export class RegisterCurrentPushDeviceResponseDto {
  status!: 'registered';
}
