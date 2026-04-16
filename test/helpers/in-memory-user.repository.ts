import { Provider } from '@localloop/shared-types';
import { User } from '../../src/modules/auth/domain/entities/user.entity';
import { IUserRepository } from '../../src/modules/auth/domain/repositories/i-user.repository';

export class InMemoryUserRepository implements IUserRepository {
  private readonly users = new Map<string, User>();

  async save(user: User): Promise<User> {
    this.users.set(user.id, user);
    return user;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async findByProvider(
    providerId: string,
    provider: Provider,
  ): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.providerId === providerId && user.provider === provider) {
        return user;
      }
    }
    return null;
  }

  async updateLastSeen(id: string): Promise<void> {
    const user = this.users.get(id);
    if (user) user.lastSeenAt = new Date();
  }

  async updateGeohash(id: string, geohash: string): Promise<void> {
    const user = this.users.get(id);
    if (user) user.geohash = geohash;
  }

  seed(user: User): void {
    this.users.set(user.id, user);
  }

  clear(): void {
    this.users.clear();
  }
}
