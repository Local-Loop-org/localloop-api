import { NotFoundException } from '@nestjs/common';
import {
  DmPermission,
  Provider,
  PushPermissionStatus,
} from '@localloop/shared-types';
import { User } from '@/modules/auth/domain/entities/user.entity';
import { IUserRepository } from '@/modules/auth/domain/repositories/i-user.repository';
import { IPushDeviceRepository } from '../../../domain/repositories/i-push-device.repository';
import { UpdatePushPermissionUseCase } from './update-push-permission.use-case';

describe('UpdatePushPermissionUseCase', () => {
  let userRepo: jest.Mocked<IUserRepository>;
  let pushDeviceRepo: jest.Mocked<IPushDeviceRepository>;
  let useCase: UpdatePushPermissionUseCase;

  const buildUser = (): User =>
    new User(
      'user-1',
      'provider-1',
      Provider.GOOGLE,
      'Andrey',
      null,
      null,
      DmPermission.MEMBERS,
      true,
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-01T00:00:00.000Z'),
      null,
    );

  beforeEach(() => {
    userRepo = {
      save: jest.fn(async (u) => u),
      findById: jest.fn(),
      findByProvider: jest.fn(),
      updateLastSeen: jest.fn(),
      updateGeohash: jest.fn(),
    };
    pushDeviceRepo = {
      upsertCurrentDevice: jest.fn(),
      listEnabledGroupMemberDevices: jest.fn(),
      disableCurrentDevice: jest.fn(),
      disableAllForUser: jest.fn(),
      disableByProviderToken: jest.fn(),
    };
    useCase = new UpdatePushPermissionUseCase(userRepo, pushDeviceRepo);
  });

  it('stores denied without disabling all devices', async () => {
    const user = buildUser();
    userRepo.findById.mockResolvedValue(user);

    await useCase.execute('user-1', {
      status: PushPermissionStatus.DENIED,
    });

    expect(user.pushPermissionStatus).toBe(PushPermissionStatus.DENIED);
    expect(userRepo.save).toHaveBeenCalledWith(user);
    expect(pushDeviceRepo.disableAllForUser).not.toHaveBeenCalled();
  });

  it('stores disabled and disables all devices for the user', async () => {
    const user = buildUser();
    userRepo.findById.mockResolvedValue(user);

    await useCase.execute('user-1', {
      status: PushPermissionStatus.DISABLED,
    });

    expect(user.pushPermissionStatus).toBe(PushPermissionStatus.DISABLED);
    expect(userRepo.save).toHaveBeenCalledWith(user);
    expect(pushDeviceRepo.disableAllForUser).toHaveBeenCalledWith('user-1');
  });

  it('throws when the user no longer exists', async () => {
    userRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('user-1', { status: PushPermissionStatus.DENIED }),
    ).rejects.toThrow(NotFoundException);
    expect(userRepo.save).not.toHaveBeenCalled();
  });
});
