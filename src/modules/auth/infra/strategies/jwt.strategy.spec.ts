import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Provider, DmPermission } from '@localloop/shared-types';
import { User } from '@/modules/auth/domain/entities/user.entity';
import { IUserRepository } from '@/modules/auth/domain/repositories/i-user.repository';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let userRepo: jest.Mocked<IUserRepository>;

  const buildUser = (overrides: Partial<User> = {}): User => {
    const user = new User(
      'user-1',
      'provider-id-1',
      Provider.GOOGLE,
      'Alice',
      null,
      null,
      DmPermission.MEMBERS,
      true,
      new Date(),
      new Date(),
    );
    Object.assign(user, overrides);
    return user;
  };

  const buildConfig = (secret: string | undefined): ConfigService =>
    ({
      get: jest.fn((key: string) =>
        key === 'JWT_SECRET' ? secret : undefined,
      ),
    }) as unknown as ConfigService;

  beforeEach(() => {
    userRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findByProvider: jest.fn(),
      updateLastSeen: jest.fn(),
      updateGeohash: jest.fn(),
    };
  });

  it('throws at construction when JWT_SECRET is not set', () => {
    expect(() => new JwtStrategy(userRepo, buildConfig(undefined))).toThrow(
      'JWT_SECRET environment variable is required',
    );
  });

  it('returns the user when payload sub resolves to an active user', async () => {
    const strategy = new JwtStrategy(userRepo, buildConfig('test-secret'));
    const user = buildUser();
    userRepo.findById.mockResolvedValue(user);

    const result = await strategy.validate({ sub: user.id });

    expect(userRepo.findById).toHaveBeenCalledWith(user.id);
    expect(result).toBe(user);
  });

  it('throws UnauthorizedException when user is not found', async () => {
    const strategy = new JwtStrategy(userRepo, buildConfig('test-secret'));
    userRepo.findById.mockResolvedValue(null);

    await expect(strategy.validate({ sub: 'missing' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when user is inactive', async () => {
    const strategy = new JwtStrategy(userRepo, buildConfig('test-secret'));
    userRepo.findById.mockResolvedValue(buildUser({ isActive: false }));

    await expect(strategy.validate({ sub: 'user-1' })).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
