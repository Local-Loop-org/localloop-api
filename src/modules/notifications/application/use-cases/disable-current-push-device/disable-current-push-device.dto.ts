import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { PushProvider } from '@localloop/shared-types';

export class DisableCurrentPushDeviceQueryDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  installationId!: string;

  @IsEnum(PushProvider)
  provider!: PushProvider;
}
