import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Provider, DmPermission } from '@localloop/shared-types';
import { User } from '@/modules/auth/domain/entities/user.entity';
import { IUserRepository } from '@/modules/auth/domain/repositories/i-user.repository';
import { SupabaseService } from '@/shared/supabase/supabase.service';
import { ExchangeGoogleTokenUseCase } from './exchange-google-token.use-case';

describe('ExchangeGoogleTokenUseCase', () => {
  let useCase: ExchangeGoogleTokenUseCase;
  let userRepo: jest.Mocked<IUserRepository>;
  let supabaseService: jest.Mocked<SupabaseService>;
  let jwtService: jest.Mocked<JwtService>;

  const buildExistingUser = (overrides: Partial<User> = {}): User => {
    const user = new User(
      'user-1',
      'provider-id-1',
      Provider.GOOGLE,
      'Alice',
      'https://old-avatar.png',
      null,
      DmPermission.MEMBERS,
      true,
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-01-01T00:00:00Z'),
    );
    Object.assign(user, overrides);
    return user;
  };

  const buildSupabaseOk = (overrides: Record<string, unknown> = {}) => ({
    data: {
      user: {
        id: 'supabase-id-1',
        email: 'alice@example.com',
        user_metadata: {
          full_name: 'Alice Doe',
          avatar_url: 'https://avatar.png',
          provider_id: 'google-sub-1',
          ...(overrides.user_metadata as Record<string, unknown> | undefined),
        },
        ...overrides,
      },
    },
    error: null,
  });

  beforeEach(() => {
    userRepo = {
      save: jest.fn().mockImplementation(async (u: User) => u),
      findById: jest.fn(),
      findByProvider: jest.fn(),
      updateLastSeen: jest.fn(),
      updateGeohash: jest.fn(),
    };

    supabaseService = {
      verifyGoogleToken: jest.fn(),
      verifyAppleToken: jest.fn(),
    } as unknown as jest.Mocked<SupabaseService>;

    jwtService = {
      sign: jest.fn((_payload, options?: { expiresIn?: string }) =>
        options?.expiresIn === '30d' ? 'refresh.token' : 'access.token',
      ),
      verify: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    useCase = new ExchangeGoogleTokenUseCase(
      userRepo,
      supabaseService,
      jwtService,
    );
  });

  it('creates a new user when no record exists for the provider id', async () => {
    supabaseService.verifyGoogleToken.mockResolvedValue(buildSupabaseOk() as any);
    userRepo.findByProvider.mockResolvedValue(null);

    const result = await useCase.execute({ token: 'google.token' });

    expect(userRepo.findByProvider).toHaveBeenCalledWith(
      'google-sub-1',
      Provider.GOOGLE,
    );
    expect(userRepo.save).toHaveBeenCalledTimes(1);
    const savedUser = userRepo.save.mock.calls[0][0];
    expect(savedUser.provider).toBe(Provider.GOOGLE);
    expect(savedUser.providerId).toBe('google-sub-1');
    expect(savedUser.displayName).toBe('Alice Doe');
    expect(savedUser.avatarUrl).toBe('https://avatar.png');
    expect(result.isNewUser).toBe(true);
    expect(result.accessToken).toBe('access.token');
    expect(result.refreshToken).toBe('refresh.token');
    expect(result.expiresIn).toBe(3600);
    expect(result.user.provider).toBe(Provider.GOOGLE);
  });

  it('updates display name, avatar and lastSeen when the user already exists', async () => {
    const existing = buildExistingUser();
    const originalLastSeen = existing.lastSeenAt;
    supabaseService.verifyGoogleToken.mockResolvedValue(buildSupabaseOk() as any);
    userRepo.findByProvider.mockResolvedValue(existing);

    const result = await useCase.execute({ token: 'google.token' });

    expect(result.isNewUser).toBe(false);
    const savedUser = userRepo.save.mock.calls[0][0];
    expect(savedUser.id).toBe(existing.id);
    expect(savedUser.displayName).toBe('Alice Doe');
    expect(savedUser.avatarUrl).toBe('https://avatar.png');
    expect(savedUser.lastSeenAt.getTime()).toBeGreaterThan(
      originalLastSeen.getTime(),
    );
  });

  it('falls back to supabase id when provider_id is missing from metadata', async () => {
    supabaseService.verifyGoogleToken.mockResolvedValue(
      buildSupabaseOk({ user_metadata: { provider_id: undefined } }) as any,
    );
    userRepo.findByProvider.mockResolvedValue(null);

    await useCase.execute({ token: 'google.token' });

    expect(userRepo.findByProvider).toHaveBeenCalledWith(
      'supabase-id-1',
      Provider.GOOGLE,
    );
  });

  it('defaults displayName to "User" when metadata has no full_name', async () => {
    supabaseService.verifyGoogleToken.mockResolvedValue(
      buildSupabaseOk({ user_metadata: { full_name: undefined } }) as any,
    );
    userRepo.findByProvider.mockResolvedValue(null);

    await useCase.execute({ token: 'google.token' });

    const savedUser = userRepo.save.mock.calls[0][0];
    expect(savedUser.displayName).toBe('User');
  });

  it('throws UnauthorizedException when supabase returns an error', async () => {
    supabaseService.verifyGoogleToken.mockResolvedValue({
      data: null,
      error: { message: 'invalid jwt' },
    } as any);

    await expect(useCase.execute({ token: 'bad.token' })).rejects.toThrow(
      new UnauthorizedException('Invalid Google token'),
    );
    expect(userRepo.findByProvider).not.toHaveBeenCalled();
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when supabase returns no user', async () => {
    supabaseService.verifyGoogleToken.mockResolvedValue({
      data: { user: null },
      error: null,
    } as any);

    await expect(useCase.execute({ token: 'empty.token' })).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
