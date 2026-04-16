import { Provider, DmPermission } from '@localloop/shared-types';
import { User } from '../../src/modules/auth/domain/entities/user.entity';

export const buildUser = (overrides: Partial<User> = {}): User => {
  const user = new User(
    overrides.id ?? 'user-test-1',
    overrides.providerId ?? 'provider-test-1',
    overrides.provider ?? Provider.GOOGLE,
    overrides.displayName ?? 'Test User',
    overrides.avatarUrl ?? null,
    overrides.geohash ?? null,
    overrides.dmPermission ?? DmPermission.MEMBERS,
    overrides.isActive ?? true,
    overrides.lastSeenAt ?? new Date('2026-01-01T00:00:00Z'),
    overrides.createdAt ?? new Date('2026-01-01T00:00:00Z'),
  );
  return user;
};
