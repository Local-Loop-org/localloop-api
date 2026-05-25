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
} from '@/modules/notifications/domain/repositories/i-push-device.repository';
import {
  IPushNotificationProvider,
  PUSH_NOTIFICATION_PROVIDER,
  PushSendResult,
} from '@/modules/notifications/domain/repositories/i-push-notification-provider';
import { RecordChatNotificationDigestUseCase } from '@/modules/notifications/application/use-cases/record-chat-notification-digest/record-chat-notification-digest.use-case';

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
    private readonly recordDigest: RecordChatNotificationDigestUseCase,
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
    const recipients = this.tokensByRecipientForCurrentProvider(devices);
    const eligibleDeviceCount = [...recipients.values()].reduce(
      (sum, tokens) => sum + tokens.length,
      0,
    );

    if (eligibleDeviceCount === 0) {
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

    const results: PushSendResult[] = [];
    for (const [recipientUserId, tokens] of recipients) {
      const digestPayload = await this.recordDigest.execute({
        recipientUserId,
        conversationKey,
        type: 'group_message',
        title: group.name,
        data,
        messageId: input.messageId,
        senderId: input.senderId,
        senderName: input.senderName,
        content: input.content,
      });
      results.push(
        ...(await this.pushProvider.send(tokens, {
          title: digestPayload.title,
          body: digestPayload.body,
          data: digestPayload.data,
          collapseId: digestPayload.collapseId,
          tag: digestPayload.tag,
          sound: digestPayload.sound,
        })),
      );
    }

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
      eligibleDeviceCount,
      sentCount: results.filter((result) => result.ok).length,
      disabledTokenCount: disabledTokens.length,
    };
  }

  private tokensByRecipientForCurrentProvider(
    devices: PushRecipientDevice[],
  ): Map<string, string[]> {
    const byRecipient = new Map<string, Set<string>>();
    for (const device of devices) {
      if (device.provider !== this.pushProvider.provider) continue;
      const tokens = byRecipient.get(device.userId) ?? new Set<string>();
      tokens.add(device.token);
      byRecipient.set(device.userId, tokens);
    }

    const result = new Map<string, string[]>();
    for (const [userId, tokens] of byRecipient) {
      if (tokens.size > 0) {
        result.set(userId, [...tokens]);
      }
    }
    return result;
  }

  private emptyResult(): SendGroupMessagePushNotificationsResult {
    return {
      eligibleDeviceCount: 0,
      sentCount: 0,
      disabledTokenCount: 0,
    };
  }
}
