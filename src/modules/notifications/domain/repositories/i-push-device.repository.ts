import {
  DevicePlatform,
  PushProvider,
} from '@localloop/shared-types';
import { PushDevice } from '../entities/push-device.entity';

export interface UpsertPushDeviceData {
  userId: string;
  installationId: string;
  provider: PushProvider;
  platform: DevicePlatform;
  token: string;
}

export interface IPushDeviceRepository {
  upsertCurrentDevice(data: UpsertPushDeviceData): Promise<PushDevice>;
  disableCurrentDevice(
    userId: string,
    installationId: string,
    provider: PushProvider,
  ): Promise<void>;
  disableAllForUser(userId: string): Promise<void>;
}

export const PUSH_DEVICE_REPOSITORY = Symbol('PUSH_DEVICE_REPOSITORY');
