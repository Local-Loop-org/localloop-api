import {
  DmPermission,
  Provider,
  PushPermissionStatus,
  UserSummary,
} from '@localloop/shared-types';
import { User } from '@/modules/auth/domain/entities/user.entity';

export class UserProfileDto implements UserSummary {
  id!: string;
  displayName!: string;
  avatarUrl!: string | null;
  dmPermission!: DmPermission;
  pushPermissionStatus!: PushPermissionStatus | null;
  provider!: Provider;
  createdAt!: string;

  static fromEntity(user: User): UserProfileDto {
    return {
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      dmPermission: user.dmPermission,
      pushPermissionStatus: user.pushPermissionStatus,
      provider: user.provider,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
