import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Provider, DmPermission } from '@localloop/shared-types';
import { User } from '@/modules/auth/domain/entities/user.entity';
import { IUserRepository } from '@/modules/auth/domain/repositories/i-user.repository';
import { buildUserRepoMock } from '@/modules/auth/test/user-repo.mock';
import { RefreshTokenUseCase } from './refresh-token.use-case';

describe('RefreshTokenUseCase', () => {
  let useCase: RefreshTokenUseCase;
  let userRepo: jest.Mocked<IUserRepository>;
  let jwtService: jest.Mocked<JwtService>;

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

  beforeEach(() => {
    userRepo = buildUserRepoMock();

    jwtService = {
      verify: jest.fn(),
      sign: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    useCase = new RefreshTokenUseCase(userRepo, jwtService);
  });

  it('returns a new access token for a valid refresh token', async () => {
    const user = buildUser();
    jwtService.verify.mockReturnValue({
      sub: user.id,
      email: 'alice@example.com',
    });
    userRepo.findById.mockResolvedValue(user);
    jwtService.sign.mockReturnValue('new.access.token');

    const result = await useCase.execute({
      refreshToken: 'valid.refresh.token',
    });

    expect(result).toEqual({
      accessToken: 'new.access.token',
      expiresIn: 3600,
    });
    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: user.id,
      email: 'alice@example.com',
    });
  });

  it('throws UnauthorizedException when the token is expired or invalid', async () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('jwt expired');
    });

    await expect(
      useCase.execute({ refreshToken: 'expired.token' }),
    ).rejects.toThrow(new UnauthorizedException('INVALID_TOKEN'));
    expect(userRepo.findById).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when the payload has no sub claim', async () => {
    jwtService.verify.mockReturnValue({ email: 'no-sub@example.com' });

    await expect(
      useCase.execute({ refreshToken: 'no.sub.token' }),
    ).rejects.toThrow(new UnauthorizedException('INVALID_TOKEN'));
    expect(userRepo.findById).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when the user is not found', async () => {
    jwtService.verify.mockReturnValue({
      sub: 'missing-user',
      email: 'x@example.com',
    });
    userRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ refreshToken: 'valid.token' }),
    ).rejects.toThrow(new UnauthorizedException('INVALID_TOKEN'));
    expect(jwtService.sign).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when the user is inactive', async () => {
    const user = buildUser({ isActive: false });
    jwtService.verify.mockReturnValue({
      sub: user.id,
      email: 'alice@example.com',
    });
    userRepo.findById.mockResolvedValue(user);

    await expect(
      useCase.execute({ refreshToken: 'valid.token' }),
    ).rejects.toThrow(new UnauthorizedException('INVALID_TOKEN'));
    expect(jwtService.sign).not.toHaveBeenCalled();
  });
});
