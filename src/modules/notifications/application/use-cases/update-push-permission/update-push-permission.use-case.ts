import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '@/modules/auth/domain/repositories/i-user.repository';
import { PushPermissionStatus } from '@localloop/shared-types';
import {
  IPushDeviceRepository,
  PUSH_DEVICE_REPOSITORY,
} from '../../../domain/repositories/i-push-device.repository';
import { UpdatePushPermissionDto } from './update-push-permission.dto';

@Injectable()
export class UpdatePushPermissionUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    @Inject(PUSH_DEVICE_REPOSITORY)
    private readonly pushDeviceRepo: IPushDeviceRepository,
  ) {}

  async execute(userId: string, dto: UpdatePushPermissionDto): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundException({
        error: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    user.pushPermissionStatus = dto.status;
    await this.userRepo.save(user);

    if (dto.status === PushPermissionStatus.DISABLED) {
      await this.pushDeviceRepo.disableAllForUser(userId);
    }
  }
}
