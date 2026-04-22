import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IUserRepository } from '@/modules/auth/domain/repositories/i-user.repository';
import { User } from '@/modules/auth/domain/entities/user.entity';
import { UserEntity } from './user.entity';
import { UserMapper } from '../mappers/user.mapper';
import { Provider } from '@localloop/shared-types';

@Injectable()
export class UserTypeORMRepository implements IUserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repo: Repository<UserEntity>,
  ) {}

  async save(user: User): Promise<User> {
    const entity = UserMapper.toPersistence(user);
    const saved = await this.repo.save(entity);
    return UserMapper.toDomain(saved as UserEntity);
  }

  async findById(id: string): Promise<User | null> {
    const entity = await this.repo.findOneBy({ id });
    return entity ? UserMapper.toDomain(entity) : null;
  }

  async findByProvider(
    providerId: string,
    provider: Provider,
  ): Promise<User | null> {
    const entity = await this.repo.findOneBy({ providerId, provider });
    return entity ? UserMapper.toDomain(entity) : null;
  }

  async updateLastSeen(id: string): Promise<void> {
    await this.repo.update(id, { lastSeenAt: new Date() });
  }

  async updateGeohash(id: string, geohash: string): Promise<void> {
    await this.repo.update(id, { geohash });
  }
}
