import {
  DevicePlatform,
  PushProvider,
} from '@localloop/shared-types';

export class PushDevice {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly installationId: string,
    public readonly provider: PushProvider,
    public platform: DevicePlatform,
    public token: string,
    public enabled: boolean,
    public lastSeenAt: Date,
    public createdAt: Date,
    public disabledAt: Date | null,
  ) {}
}
