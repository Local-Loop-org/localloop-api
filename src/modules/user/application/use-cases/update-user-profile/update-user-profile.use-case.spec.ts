import { NotFoundException } from '@nestjs/common';
import { DmPermission, Provider } from '@localloop/shared-types';
import { User } from '@/modules/auth/domain/entities/user.entity';
import { IUserRepository } from '@/modules/auth/domain/repositories/i-user.repository';
import { UpdateUserProfileUseCase } from './update-user-profile.use-case';

describe('UpdateUserProfileUseCase', () => {
  let useCase: UpdateUserProfileUseCase;
  let userRepo: jest.Mocked<IUserRepository>;

  const buildUser = (overrides: Partial<User> = {}): User => {
    const user = new User(
      'user-1',
      'provider-id-1',
      Provider.GOOGLE,
      'Alice',
      'https://avatar.png',
      null,
      DmPermission.MEMBERS,
      true,
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-01-01T00:00:00Z'),
    );
    Object.assign(user, overrides);
    return user;
  };

  beforeEach(() => {
    userRepo = {
      save: jest.fn().mockImplementation(async (u: User) => u),
      findById: jest.fn(),
      findByProvider: jest.fn(),
      updateLastSeen: jest.fn(),
      updateGeohash: jest.fn(),
    };

    useCase = new UpdateUserProfileUseCase(userRepo);
  });

  it('throws NotFoundException when the user does not exist', async () => {
    userRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('missing', { displayName: 'Bob' }),
    ).rejects.toThrow(new NotFoundException('User not found'));
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('updates only displayName when dmPermission is undefined', async () => {
    const user = buildUser();
    userRepo.findById.mockResolvedValue(user);

    await useCase.execute('user-1', { displayName: 'New Name' });

    const saved = userRepo.save.mock.calls[0][0];
    expect(saved.displayName).toBe('New Name');
    expect(saved.dmPermission).toBe(DmPermission.MEMBERS);
  });

  it('updates only dmPermission when displayName is undefined', async () => {
    const user = buildUser();
    userRepo.findById.mockResolvedValue(user);

    await useCase.execute('user-1', { dmPermission: DmPermission.NOBODY });

    const saved = userRepo.save.mock.calls[0][0];
    expect(saved.displayName).toBe('Alice');
    expect(saved.dmPermission).toBe(DmPermission.NOBODY);
  });

  it('updates both fields when both are provided', async () => {
    const user = buildUser();
    userRepo.findById.mockResolvedValue(user);

    await useCase.execute('user-1', {
      displayName: 'Carol',
      dmPermission: DmPermission.NOBODY,
    });

    const saved = userRepo.save.mock.calls[0][0];
    expect(saved.displayName).toBe('Carol');
    expect(saved.dmPermission).toBe(DmPermission.NOBODY);
  });

  it('persists an unchanged user when both fields are undefined', async () => {
    const user = buildUser();
    userRepo.findById.mockResolvedValue(user);

    await useCase.execute('user-1', {});

    expect(userRepo.save).toHaveBeenCalledTimes(1);
    const saved = userRepo.save.mock.calls[0][0];
    expect(saved.displayName).toBe('Alice');
    expect(saved.dmPermission).toBe(DmPermission.MEMBERS);
  });

  it('returns the UserProfileDto shape derived from the saved entity', async () => {
    const user = buildUser();
    userRepo.findById.mockResolvedValue(user);

    const result = await useCase.execute('user-1', { displayName: 'Dora' });

    expect(result).toEqual({
      id: 'user-1',
      displayName: 'Dora',
      avatarUrl: 'https://avatar.png',
      dmPermission: DmPermission.MEMBERS,
      provider: Provider.GOOGLE,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });
});
