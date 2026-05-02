import { DmPermission, Provider } from '@localloop/shared-types';
import { User } from '@/modules/auth/domain/entities/user.entity';
import { UserEntity } from '../repositories/user.entity';
import { UserMapper } from './user.mapper';

describe('UserMapper', () => {
  const buildDomain = (): User =>
    new User(
      'user-1',
      'provider-id-1',
      Provider.GOOGLE,
      'Alice',
      'https://avatar.png',
      'gcpvj0',
      DmPermission.MEMBERS,
      true,
      new Date('2026-02-01T00:00:00.000Z'),
      new Date('2026-01-01T00:00:00.000Z'),
    );

  it('toPersistence carries every domain field, including createdAt', () => {
    const persisted = UserMapper.toPersistence(buildDomain());

    expect(persisted).toEqual({
      id: 'user-1',
      providerId: 'provider-id-1',
      provider: Provider.GOOGLE,
      displayName: 'Alice',
      avatarUrl: 'https://avatar.png',
      geohash: 'gcpvj0',
      dmPermission: DmPermission.MEMBERS,
      isActive: true,
      lastSeenAt: new Date('2026-02-01T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
  });

  it('round-trips toPersistence -> toDomain without losing fields', () => {
    const original = buildDomain();
    const roundTripped = UserMapper.toDomain(
      UserMapper.toPersistence(original) as UserEntity,
    );

    expect(roundTripped).toEqual(original);
  });
});
