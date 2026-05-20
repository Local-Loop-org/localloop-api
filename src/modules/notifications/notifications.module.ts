import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@/modules/auth/auth.module';
import { GroupsModule } from '@/modules/groups/groups.module';
import { PUSH_DEVICE_REPOSITORY } from './domain/repositories/i-push-device.repository';
import { PUSH_NOTIFICATION_PROVIDER } from './domain/repositories/i-push-notification-provider';
import { PushDeviceOrmEntity } from './infra/repositories/push-device.entity';
import { PushDeviceTypeORMRepository } from './infra/repositories/push-device.typeorm.repository';
import { ExpoPushNotificationProvider } from './infra/providers/expo-push-notification.provider';
import { RegisterCurrentPushDeviceUseCase } from './application/use-cases/register-current-push-device/register-current-push-device.use-case';
import { DisableCurrentPushDeviceUseCase } from './application/use-cases/disable-current-push-device/disable-current-push-device.use-case';
import { UpdatePushPermissionUseCase } from './application/use-cases/update-push-permission/update-push-permission.use-case';
import { SendGroupMessagePushNotificationsUseCase } from './application/use-cases/send-group-message-push-notifications/send-group-message-push-notifications.use-case';
import { SendDirectMessagePushNotificationsUseCase } from './application/use-cases/send-direct-message-push-notifications/send-direct-message-push-notifications.use-case';
import { NotificationsController } from './presentation/notifications.controller';

@Module({
  imports: [
    AuthModule,
    GroupsModule,
    TypeOrmModule.forFeature([PushDeviceOrmEntity]),
  ],
  controllers: [NotificationsController],
  providers: [
    RegisterCurrentPushDeviceUseCase,
    DisableCurrentPushDeviceUseCase,
    UpdatePushPermissionUseCase,
    SendGroupMessagePushNotificationsUseCase,
    SendDirectMessagePushNotificationsUseCase,
    {
      provide: PUSH_DEVICE_REPOSITORY,
      useClass: PushDeviceTypeORMRepository,
    },
    {
      provide: PUSH_NOTIFICATION_PROVIDER,
      useClass: ExpoPushNotificationProvider,
    },
  ],
  exports: [
    PUSH_DEVICE_REPOSITORY,
    PUSH_NOTIFICATION_PROVIDER,
    SendGroupMessagePushNotificationsUseCase,
    SendDirectMessagePushNotificationsUseCase,
  ],
})
export class NotificationsModule {}
