import { PushProvider } from '@localloop/shared-types';
import { IPushDeviceRepository } from '../../../domain/repositories/i-push-device.repository';
import { DisableCurrentPushDeviceUseCase } from './disable-current-push-device.use-case';

describe('DisableCurrentPushDeviceUseCase', () => {
  it('disables only the current installation for the user', async () => {
    const pushDeviceRepo: jest.Mocked<IPushDeviceRepository> = {
      upsertCurrentDevice: jest.fn(),
      listEnabledGroupMemberDevices: jest.fn(),
      disableCurrentDevice: jest.fn(),
      disableAllForUser: jest.fn(),
      disableByProviderToken: jest.fn(),
    };
    const useCase = new DisableCurrentPushDeviceUseCase(pushDeviceRepo);

    await useCase.execute('user-1', {
      installationId: 'install-123',
      provider: PushProvider.EXPO,
    });

    expect(pushDeviceRepo.disableCurrentDevice).toHaveBeenCalledWith(
      'user-1',
      'install-123',
      PushProvider.EXPO,
    );
    expect(pushDeviceRepo.disableAllForUser).not.toHaveBeenCalled();
  });
});
