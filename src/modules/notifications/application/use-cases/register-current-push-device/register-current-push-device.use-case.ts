import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PushPermissionStatus, PushProvider } from '@localloop/shared-types';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '@/modules/auth/domain/repositories/i-user.repository';
import {
  IPushDeviceRepository,
  PUSH_DEVICE_REPOSITORY,
} from '../../../domain/repositories/i-push-device.repository';
import {
  IPushNotificationProvider,
  PUSH_NOTIFICATION_PROVIDER,
} from '../../../domain/repositories/i-push-notification-provider';
import {
  RegisterCurrentPushDeviceDto,
  RegisterCurrentPushDeviceResponseDto,
} from './register-current-push-device.dto';

@Injectable()
export class RegisterCurrentPushDeviceUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    @Inject(PUSH_DEVICE_REPOSITORY)
    private readonly pushDeviceRepo: IPushDeviceRepository,
    @Inject(PUSH_NOTIFICATION_PROVIDER)
    private readonly pushProvider: IPushNotificationProvider,
  ) {}

  async execute(
    userId: string,
    dto: RegisterCurrentPushDeviceDto,
  ): Promise<RegisterCurrentPushDeviceResponseDto> {
    if (dto.provider !== PushProvider.EXPO) {
      throw new BadRequestException({
        error: 'UNSUPPORTED_PUSH_PROVIDER',
        message: 'Push provider is not supported',
      });
    }

    if (!this.pushProvider.validateToken(dto.token)) {
      throw new BadRequestException({
        error: 'INVALID_PUSH_TOKEN',
        message: 'Push token is invalid for the selected provider',
      });
    }

    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundException({
        error: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    await this.pushDeviceRepo.upsertCurrentDevice({
      userId,
      installationId: dto.installationId,
      provider: dto.provider,
      platform: dto.platform,
      token: dto.token,
    });

    user.pushPermissionStatus = PushPermissionStatus.GRANTED;
    await this.userRepo.save(user);

    return { status: 'registered' };
  }
}
