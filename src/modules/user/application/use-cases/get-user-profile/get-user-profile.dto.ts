import { Provider, DmPermission } from '@localloop/shared-types';
import { User } from '@/modules/auth/domain/entities/user.entity';

export class UserProfileDto {
  id!: string;
  displayName!: string;
  avatarUrl!: string | null;
  dmPermission!: DmPermission;
  provider!: Provider;
  createdAt!: string;

  static fromEntity(user: User): UserProfileDto {
    return {
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      dmPermission: user.dmPermission,
      provider: user.provider,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
