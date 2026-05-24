import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@/modules/auth/auth.module';
import { GroupsModule } from '@/modules/groups/groups.module';
import { CHAT_NOTIFICATION_DIGEST_REPOSITORY } from './domain/repositories/i-chat-notification-digest.repository';
import { PUSH_DEVICE_REPOSITORY } from './domain/repositories/i-push-device.repository';
import { PUSH_NOTIFICATION_PROVIDER } from './domain/repositories/i-push-notification-provider';
import { ChatNotificationDigestOrmEntity } from './infra/repositories/chat-notification-digest.entity';
import { ChatNotificationDigestTypeORMRepository } from './infra/repositories/chat-notification-digest.typeorm.repository';
import { PushDeviceOrmEntity } from './infra/repositories/push-device.entity';
import { PushDeviceTypeORMRepository } from './infra/repositories/push-device.typeorm.repository';
import { ExpoPushNotificationProvider } from './infra/providers/expo-push-notification.provider';
import { ClearChatNotificationDigestUseCase } from './application/use-cases/clear-chat-notification-digest/clear-chat-notification-digest.use-case';
import { RegisterCurrentPushDeviceUseCase } from './application/use-cases/register-current-push-device/register-current-push-device.use-case';
import { DisableCurrentPushDeviceUseCase } from './application/use-cases/disable-current-push-device/disable-current-push-device.use-case';
import { UpdatePushPermissionUseCase } from './application/use-cases/update-push-permission/update-push-permission.use-case';
import { RecordChatNotificationDigestUseCase } from './application/use-cases/record-chat-notification-digest/record-chat-notification-digest.use-case';
import { SendGroupMessagePushNotificationsUseCase } from './application/use-cases/send-group-message-push-notifications/send-group-message-push-notifications.use-case';
import { SendDirectMessagePushNotificationsUseCase } from './application/use-cases/send-direct-message-push-notifications/send-direct-message-push-notifications.use-case';
import { NotificationsController } from './presentation/notifications.controller';

@Module({
  imports: [
    AuthModule,
    GroupsModule,
    TypeOrmModule.forFeature([
      PushDeviceOrmEntity,
      ChatNotificationDigestOrmEntity,
    ]),
  ],
  controllers: [NotificationsController],
  providers: [
    ClearChatNotificationDigestUseCase,
    RegisterCurrentPushDeviceUseCase,
    DisableCurrentPushDeviceUseCase,
    UpdatePushPermissionUseCase,
    RecordChatNotificationDigestUseCase,
    SendGroupMessagePushNotificationsUseCase,
    SendDirectMessagePushNotificationsUseCase,
    {
      provide: CHAT_NOTIFICATION_DIGEST_REPOSITORY,
      useClass: ChatNotificationDigestTypeORMRepository,
    },
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
    ClearChatNotificationDigestUseCase,
    PUSH_DEVICE_REPOSITORY,
    PUSH_NOTIFICATION_PROVIDER,
    SendGroupMessagePushNotificationsUseCase,
    SendDirectMessagePushNotificationsUseCase,
  ],
})
export class NotificationsModule {}
