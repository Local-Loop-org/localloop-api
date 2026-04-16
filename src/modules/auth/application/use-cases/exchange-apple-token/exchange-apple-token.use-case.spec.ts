import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Provider, DmPermission } from '@localloop/shared-types';
import { User } from '@/modules/auth/domain/entities/user.entity';
import { IUserRepository } from '@/modules/auth/domain/repositories/i-user.repository';
import { SupabaseService } from '@/shared/supabase/supabase.service';
import { ExchangeAppleTokenUseCase } from './exchange-apple-token.use-case';

describe('ExchangeAppleTokenUseCase', () => {
  let useCase: ExchangeAppleTokenUseCase;
  let userRepo: jest.Mocked<IUserRepository>;
  let supabaseService: jest.Mocked<SupabaseService>;
  let jwtService: jest.Mocked<JwtService>;

  const buildExistingUser = (overrides: Partial<User> = {}): User => {
    const user = new User(
      'user-2',
      'apple-sub-1',
      Provider.APPLE,
      'Bob',
      null,
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
        id: 'supabase-id-2',
        email: 'bob@example.com',
        user_metadata: {
          full_name: 'Bob Smith',
          avatar_url: 'https://apple-avatar.png',
          provider_id: 'apple-sub-1',
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

    useCase = new ExchangeAppleTokenUseCase(
      userRepo,
      supabaseService,
      jwtService,
    );
  });

  it('creates a new user on first Apple login', async () => {
    supabaseService.verifyAppleToken.mockResolvedValue(buildSupabaseOk() as any);
    userRepo.findByProvider.mockResolvedValue(null);

    const result = await useCase.execute({
      token: 'apple.token',
      identityToken: 'apple.identity',
    });

    expect(supabaseService.verifyAppleToken).toHaveBeenCalledWith(
      'apple.token',
      'apple.identity',
    );
    expect(userRepo.findByProvider).toHaveBeenCalledWith(
      'apple-sub-1',
      Provider.APPLE,
    );
    const savedUser = userRepo.save.mock.calls[0][0];
    expect(savedUser.provider).toBe(Provider.APPLE);
    expect(savedUser.displayName).toBe('Bob Smith');
    expect(result.isNewUser).toBe(true);
    expect(result.user.provider).toBe(Provider.APPLE);
  });

  it('updates existing user metadata on subsequent Apple login', async () => {
    const existing = buildExistingUser();
    supabaseService.verifyAppleToken.mockResolvedValue(buildSupabaseOk() as any);
    userRepo.findByProvider.mockResolvedValue(existing);

    const result = await useCase.execute({
      token: 'apple.token',
      identityToken: 'apple.identity',
    });

    expect(result.isNewUser).toBe(false);
    const savedUser = userRepo.save.mock.calls[0][0];
    expect(savedUser.displayName).toBe('Bob Smith');
    expect(savedUser.avatarUrl).toBe('https://apple-avatar.png');
  });

  it('preserves existing avatar when metadata omits avatar_url', async () => {
    const existing = buildExistingUser({ avatarUrl: 'https://kept.png' });
    supabaseService.verifyAppleToken.mockResolvedValue(
      buildSupabaseOk({ user_metadata: { avatar_url: undefined } }) as any,
    );
    userRepo.findByProvider.mockResolvedValue(existing);

    await useCase.execute({
      token: 'apple.token',
      identityToken: 'apple.identity',
    });

    const savedUser = userRepo.save.mock.calls[0][0];
    expect(savedUser.avatarUrl).toBe('https://kept.png');
  });

  it('throws UnauthorizedException on supabase error', async () => {
    supabaseService.verifyAppleToken.mockResolvedValue({
      data: null,
      error: { message: 'bad token' },
    } as any);

    await expect(
      useCase.execute({ token: 'bad', identityToken: 'bad' }),
    ).rejects.toThrow(new UnauthorizedException('Invalid Apple token'));
    expect(userRepo.save).not.toHaveBeenCalled();
  });
});
