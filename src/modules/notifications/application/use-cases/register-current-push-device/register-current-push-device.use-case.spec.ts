import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  DevicePlatform,
  DmPermission,
  Provider,
  PushPermissionStatus,
  PushProvider,
} from '@localloop/shared-types';
import { User } from '@/modules/auth/domain/entities/user.entity';
import { IUserRepository } from '@/modules/auth/domain/repositories/i-user.repository';
import { IPushDeviceRepository } from '../../../domain/repositories/i-push-device.repository';
import { IPushNotificationProvider } from '../../../domain/repositories/i-push-notification-provider';
import { RegisterCurrentPushDeviceUseCase } from './register-current-push-device.use-case';

describe('RegisterCurrentPushDeviceUseCase', () => {
  let userRepo: jest.Mocked<IUserRepository>;
  let pushDeviceRepo: jest.Mocked<IPushDeviceRepository>;
  let pushProvider: jest.Mocked<IPushNotificationProvider>;
  let useCase: RegisterCurrentPushDeviceUseCase;

  const user = new User(
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

  const dto = {
    installationId: 'install-123',
    provider: PushProvider.EXPO,
    platform: DevicePlatform.IOS,
    token: 'ExponentPushToken[abc123]',
  };

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
      listEnabledDevicesForUser: jest.fn(),
      disableCurrentDevice: jest.fn(),
      disableAllForUser: jest.fn(),
      disableByProviderToken: jest.fn(),
    };
    pushProvider = {
      provider: PushProvider.EXPO,
      validateToken: jest.fn(),
      send: jest.fn(),
    };
    useCase = new RegisterCurrentPushDeviceUseCase(
      userRepo,
      pushDeviceRepo,
      pushProvider,
    );
  });

  it('upserts the device and marks permission granted', async () => {
    userRepo.findById.mockResolvedValue(user);
    pushProvider.validateToken.mockReturnValue(true);

    const result = await useCase.execute('user-1', dto);

    expect(pushDeviceRepo.upsertCurrentDevice).toHaveBeenCalledWith({
      userId: 'user-1',
      installationId: 'install-123',
      provider: PushProvider.EXPO,
      platform: DevicePlatform.IOS,
      token: 'ExponentPushToken[abc123]',
    });
    expect(user.pushPermissionStatus).toBe(PushPermissionStatus.GRANTED);
    expect(userRepo.save).toHaveBeenCalledWith(user);
    expect(result).toEqual({ status: 'registered' });
  });

  it('rejects invalid Expo tokens before saving', async () => {
    pushProvider.validateToken.mockReturnValue(false);

    await expect(useCase.execute('user-1', dto)).rejects.toThrow(
      BadRequestException,
    );
    expect(userRepo.save).not.toHaveBeenCalled();
    expect(pushDeviceRepo.upsertCurrentDevice).not.toHaveBeenCalled();
  });

  it('throws when the authenticated user no longer exists', async () => {
    pushProvider.validateToken.mockReturnValue(true);
    userRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('user-1', dto)).rejects.toThrow(
      NotFoundException,
    );
    expect(pushDeviceRepo.upsertCurrentDevice).not.toHaveBeenCalled();
  });
});
