import { DmPermission, Provider } from '@localloop/shared-types';

import { User } from '@/modules/auth/domain/entities/user.entity';
import { IUserRepository } from '@/modules/auth/domain/repositories/i-user.repository';

export function buildUserRepoMock(): jest.Mocked<IUserRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findByProvider: jest.fn(),
    updateLastSeen: jest.fn(),
    updateGeohash: jest.fn(),
  };
}

export function buildUser(overrides: Partial<User> = {}): User {
  return new User(
    overrides.id ?? 'user-recipient',
    overrides.providerId ?? 'provider-id',
    overrides.provider ?? Provider.GOOGLE,
    overrides.displayName ?? 'Bob',
    overrides.avatarUrl ?? null,
    overrides.geohash ?? null,
    overrides.dmPermission ?? DmPermission.EVERYONE,
    overrides.isActive ?? true,
    overrides.lastSeenAt ?? new Date('2026-05-15T00:00:00Z'),
    overrides.createdAt ?? new Date('2026-04-01T00:00:00Z'),
    overrides.pushPermissionStatus ?? null,
  );
}
