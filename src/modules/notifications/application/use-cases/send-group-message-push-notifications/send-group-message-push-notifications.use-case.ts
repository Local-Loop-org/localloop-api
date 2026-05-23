import { Inject, Injectable } from '@nestjs/common';
import type { GroupMessagePushNotificationData } from '@localloop/shared-types';
import {
  GROUP_REPOSITORY,
  IGroupRepository,
} from '@/modules/groups/domain/repositories/i-group.repository';
import {
  IPushDeviceRepository,
  PUSH_DEVICE_REPOSITORY,
  PushRecipientDevice,
} from '../../../domain/repositories/i-push-device.repository';
import {
  IPushNotificationProvider,
  PUSH_NOTIFICATION_PROVIDER,
} from '../../../domain/repositories/i-push-notification-provider';

const MAX_PREVIEW_LENGTH = 120;
const TRUNCATED_PREVIEW_LENGTH = MAX_PREVIEW_LENGTH - 3;
const DEVICE_NOT_REGISTERED = 'DeviceNotRegistered';

export interface SendGroupMessagePushNotificationsInput {
  groupId: string;
  messageId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  content: string | null;
  excludedUserIds: string[];
}

export interface SendGroupMessagePushNotificationsResult {
  eligibleDeviceCount: number;
  sentCount: number;
  disabledTokenCount: number;
}

@Injectable()
export class SendGroupMessagePushNotificationsUseCase {
  constructor(
    @Inject(PUSH_DEVICE_REPOSITORY)
    private readonly pushDeviceRepo: IPushDeviceRepository,
    @Inject(PUSH_NOTIFICATION_PROVIDER)
    private readonly pushProvider: IPushNotificationProvider,
    @Inject(GROUP_REPOSITORY) private readonly groupRepo: IGroupRepository,
  ) {}

  async execute(
    input: SendGroupMessagePushNotificationsInput,
  ): Promise<SendGroupMessagePushNotificationsResult> {
    const group = await this.groupRepo.findById(input.groupId);
    if (!group) {
      return this.emptyResult();
    }

    const excludedUserIds = [
      ...new Set([input.senderId, ...input.excludedUserIds]),
    ];
    const devices = await this.pushDeviceRepo.listEnabledGroupMemberDevices(
      input.groupId,
      excludedUserIds,
    );
    const eligibleDevices = this.devicesForCurrentProvider(devices);
    const tokens = [...eligibleDevices.keys()];

    if (tokens.length === 0) {
      return this.emptyResult();
    }

    const conversationKey: GroupMessagePushNotificationData['conversationKey'] = `group:${input.groupId}`;
    const data = {
      type: 'group_message',
      conversationKey,
      groupId: input.groupId,
      groupName: group.name,
      anchorType: group.anchorType,
      messageId: input.messageId,
      senderId: input.senderId,
      senderName: input.senderName,
      senderAvatarUrl: input.senderAvatarUrl,
    } satisfies GroupMessagePushNotificationData;

    const results = await this.pushProvider.send(tokens, {
      title: group.name,
      body: `${input.senderName}: ${this.preview(input.content)}`,
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

  private emptyResult(): SendGroupMessagePushNotificationsResult {
    return {
      eligibleDeviceCount: 0,
      sentCount: 0,
      disabledTokenCount: 0,
    };
  }
}
