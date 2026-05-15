import { DevicePlatform, PushProvider } from '@localloop/shared-types';
import { PushDevice } from '../entities/push-device.entity';

export interface UpsertPushDeviceData {
  userId: string;
  installationId: string;
  provider: PushProvider;
  platform: DevicePlatform;
  token: string;
}

export interface PushRecipientDevice {
  userId: string;
  provider: PushProvider;
  token: string;
}

export interface IPushDeviceRepository {
  upsertCurrentDevice(data: UpsertPushDeviceData): Promise<PushDevice>;
  listEnabledGroupMemberDevices(
    groupId: string,
    excludedUserIds: string[],
  ): Promise<PushRecipientDevice[]>;
  disableCurrentDevice(
    userId: string,
    installationId: string,
    provider: PushProvider,
  ): Promise<void>;
  disableAllForUser(userId: string): Promise<void>;
  disableByProviderToken(provider: PushProvider, token: string): Promise<void>;
}

export const PUSH_DEVICE_REPOSITORY = Symbol('PUSH_DEVICE_REPOSITORY');
