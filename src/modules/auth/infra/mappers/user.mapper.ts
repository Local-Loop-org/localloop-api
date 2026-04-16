import { User } from '../../domain/entities/user.entity';
import { UserEntity } from '../repositories/user.entity';

export class UserMapper {
  static toDomain(entity: UserEntity): User {
    return new User(
      entity.id,
      entity.providerId,
      entity.provider,
      entity.displayName,
      entity.avatarUrl,
      entity.geohash,
      entity.dmPermission,
      entity.isActive,
      entity.lastSeenAt,
      entity.createdAt,
    );
  }

  static toPersistence(domain: User): Partial<UserEntity> {
    return {
      id: domain.id,
      providerId: domain.providerId,
      provider: domain.provider,
      displayName: domain.displayName,
      avatarUrl: domain.avatarUrl,
      geohash: domain.geohash,
      dmPermission: domain.dmPermission,
      isActive: domain.isActive,
      lastSeenAt: domain.lastSeenAt,
    };
  }
}
