import { Inject, Injectable } from '@nestjs/common';
import type { DirectMessagePushNotificationData } from '@localloop/shared-types';
import {
  IPushDeviceRepository,
  PUSH_DEVICE_REPOSITORY,
  PushRecipientDevice,
} from '@/modules/notifications/domain/repositories/i-push-device.repository';
import {
  IPushNotificationProvider,
  PUSH_NOTIFICATION_PROVIDER,
} from '@/modules/notifications/domain/repositories/i-push-notification-provider';
import { RecordChatNotificationDigestUseCase } from '../record-chat-notification-digest/record-chat-notification-digest.use-case';

const DEVICE_NOT_REGISTERED = 'DeviceNotRegistered';

export interface SendDirectMessagePushNotificationsInput {
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  recipientId: string;
  messageId: string;
  content: string | null;
}

export interface SendDirectMessagePushNotificationsResult {
  eligibleDeviceCount: number;
  sentCount: number;
  disabledTokenCount: number;
}

@Injectable()
export class SendDirectMessagePushNotificationsUseCase {
  constructor(
    @Inject(PUSH_DEVICE_REPOSITORY)
    private readonly pushDeviceRepo: IPushDeviceRepository,
    @Inject(PUSH_NOTIFICATION_PROVIDER)
    private readonly pushProvider: IPushNotificationProvider,
    private readonly recordDigest: RecordChatNotificationDigestUseCase,
  ) {}

  async execute(
    input: SendDirectMessagePushNotificationsInput,
  ): Promise<SendDirectMessagePushNotificationsResult> {
    const devices = await this.pushDeviceRepo.listEnabledDevicesForUser(
      input.recipientId,
    );
    const tokens = this.tokensForCurrentProvider(devices);

    if (tokens.length === 0) {
      return this.emptyResult();
    }

    const peerName =
      input.senderName.trim().length > 0 ? input.senderName : 'Alguém';
    const conversationKey: DirectMessagePushNotificationData['conversationKey'] = `dm:${input.senderId}`;
    const data = {
      type: 'direct_message',
      conversationKey,
      peerId: input.senderId,
      peerName,
      peerAvatarUrl: input.senderAvatarUrl,
      messageId: input.messageId,
    } satisfies DirectMessagePushNotificationData;

    const digestPayload = await this.recordDigest.execute({
      recipientUserId: input.recipientId,
      conversationKey,
      type: 'direct_message',
      title: peerName,
      data,
      messageId: input.messageId,
      senderId: input.senderId,
      senderName: peerName,
      content: input.content,
    });
    const payload = {
      title: digestPayload.title,
      body: digestPayload.body,
      data: digestPayload.data,
      collapseId: digestPayload.collapseId,
      tag: digestPayload.tag,
      sound: digestPayload.sound,
    };
    const results = await this.pushProvider.send(tokens, payload);

    const disabledTokens = [
      ...new Set(
        results
          .filter((result) => result.errorCode === DEVICE_NOT_REGISTERED)
          .map((result) => result.token)
          .filter((token) => token.length > 0),
      ),
    ];
    await Promise.all(
      disabledTokens.map((token) =>
        this.pushDeviceRepo.disableByProviderToken(
          this.pushProvider.provider,
          token,
        ),
      ),
    );

    return {
      eligibleDeviceCount: tokens.length,
      sentCount: results.filter((result) => result.ok).length,
      disabledTokenCount: disabledTokens.length,
    };
  }

  private tokensForCurrentProvider(devices: PushRecipientDevice[]): string[] {
    const tokens = new Set<string>();
    for (const device of devices) {
      if (device.provider !== this.pushProvider.provider) continue;
      tokens.add(device.token);
    }
    return [...tokens];
  }

  private emptyResult(): SendDirectMessagePushNotificationsResult {
    return {
      eligibleDeviceCount: 0,
      sentCount: 0,
      disabledTokenCount: 0,
    };
  }
}
