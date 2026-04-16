import { User } from '../entities/user.entity';
import { Provider } from '@localloop/shared-types';

export interface IUserRepository {
  save(user: User): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByProvider(providerId: string, provider: Provider): Promise<User | null>;
  updateLastSeen(id: string): Promise<void>;
  updateGeohash(id: string, geohash: string): Promise<void>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
