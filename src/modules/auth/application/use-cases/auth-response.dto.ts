import {
  DmPermission,
  Provider,
  PushPermissionStatus,
  UserSummary,
} from '@localloop/shared-types';
import { User } from '@/modules/auth/domain/entities/user.entity';

export class UserSummaryDto implements UserSummary {
  id!: string;
  displayName!: string;
  avatarUrl!: string | null;
  dmPermission!: DmPermission;
  pushPermissionStatus!: PushPermissionStatus | null;
  provider!: Provider;
  createdAt!: string;

  static fromEntity(user: User): UserSummaryDto {
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

export class AuthResponseDto {
  accessToken!: string;
  refreshToken!: string;
  expiresIn!: number;
  isNewUser!: boolean;
  user!: UserSummaryDto;
}
