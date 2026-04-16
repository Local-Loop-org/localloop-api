import { Provider } from '@localloop/shared-types';
import { User } from '@/modules/auth/domain/entities/user.entity';

export class UserSummaryDto {
  id!: string;
  displayName!: string;
  avatarUrl!: string | null;
  provider!: Provider;

  static fromEntity(user: User): UserSummaryDto {
    return {
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      provider: user.provider,
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
