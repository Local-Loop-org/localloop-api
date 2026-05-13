import { IsIn } from 'class-validator';
import { PushPermissionStatus } from '@localloop/shared-types';

export class UpdatePushPermissionDto {
  @IsIn([PushPermissionStatus.DENIED, PushPermissionStatus.DISABLED])
  status!: PushPermissionStatus.DENIED | PushPermissionStatus.DISABLED;
}
