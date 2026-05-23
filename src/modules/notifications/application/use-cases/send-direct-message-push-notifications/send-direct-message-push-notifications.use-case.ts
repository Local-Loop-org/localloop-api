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

const MAX_PREVIEW_LENGTH = 120;
const TRUNCATED_PREVIEW_LENGTH = MAX_PREVIEW_LENGTH - 3;
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
  ) {}

  async execute(
    input: SendDirectMessagePushNotificationsInput,
  ): Promise<SendDirectMessagePushNotificationsResult> {
    const devices = await this.pushDeviceRepo.listEnabledDevicesForUser(
      input.recipientId,
    );
    const eligibleDevices = this.devicesForCurrentProvider(devices);
    const tokens = [...eligibleDevices.keys()];

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

    const results = await this.pushProvider.send(tokens, {
      title: peerName,
      body: this.preview(input.content),
      data,
    });

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

  private devicesForCurrentProvider(
    devices: PushRecipientDevice[],
  ): Map<string, PushRecipientDevice> {
    const byToken = new Map<string, PushRecipientDevice>();
    for (const device of devices) {
      if (device.provider !== this.pushProvider.provider) continue;
      if (!byToken.has(device.token)) {
        byToken.set(device.token, device);
      }
    }
    return byToken;
  }

  private preview(content: string | null): string {
    const normalized = (content ?? 'Nova mensagem').replace(/\s+/g, ' ').trim();
    if (!normalized) return 'Nova mensagem';
    if (normalized.length <= MAX_PREVIEW_LENGTH) return normalized;
    return `${normalized.slice(0, TRUNCATED_PREVIEW_LENGTH).trimEnd()}...`;
  }

  private emptyResult(): SendDirectMessagePushNotificationsResult {
    return {
      eligibleDeviceCount: 0,
      sentCount: 0,
      disabledTokenCount: 0,
    };
  }
}
