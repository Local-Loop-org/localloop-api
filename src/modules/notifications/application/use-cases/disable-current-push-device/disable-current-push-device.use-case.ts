import { Inject, Injectable } from '@nestjs/common';
import {
  IPushDeviceRepository,
  PUSH_DEVICE_REPOSITORY,
} from '../../../domain/repositories/i-push-device.repository';
import { DisableCurrentPushDeviceQueryDto } from './disable-current-push-device.dto';

@Injectable()
export class DisableCurrentPushDeviceUseCase {
  constructor(
    @Inject(PUSH_DEVICE_REPOSITORY)
    private readonly pushDeviceRepo: IPushDeviceRepository,
  ) {}

  async execute(
    userId: string,
    query: DisableCurrentPushDeviceQueryDto,
  ): Promise<void> {
    await this.pushDeviceRepo.disableCurrentDevice(
      userId,
      query.installationId,
      query.provider,
    );
  }
}
