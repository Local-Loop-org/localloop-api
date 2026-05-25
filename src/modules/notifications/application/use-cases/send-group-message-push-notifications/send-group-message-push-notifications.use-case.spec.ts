import {
  AnchorType,
  GroupPrivacy,
  PushProvider,
} from '@localloop/shared-types';
import { Group } from '@/modules/groups/domain/entities/group.entity';
import { buildGroupRepoMock } from '@/modules/groups/test/group-repo.mock';
import {
  ChatNotificationDigestState,
  IChatNotificationDigestRepository,
  RecordChatNotificationDigestInput,
} from '@/modules/notifications/domain/repositories/i-chat-notification-digest.repository';
import {
  IPushDeviceRepository,
  PushRecipientDevice,
} from '@/modules/notifications/domain/repositories/i-push-device.repository';
import { IPushNotificationProvider } from '@/modules/notifications/domain/repositories/i-push-notification-provider';
import { RecordChatNotificationDigestUseCase } from '@/modules/notifications/application/use-cases/record-chat-notification-digest/record-chat-notification-digest.use-case';
import { SendGroupMessagePushNotificationsUseCase } from '@/modules/notifications/application/use-cases/send-group-message-push-notifications/send-group-message-push-notifications.use-case';

describe('SendGroupMessagePushNotificationsUseCase', () => {
  let useCase: SendGroupMessagePushNotificationsUseCase;
  let pushDeviceRepo: jest.Mocked<IPushDeviceRepository>;
  let pushProvider: jest.Mocked<IPushNotificationProvider>;
  let digestRepo: jest.Mocked<IChatNotificationDigestRepository>;
  let groupRepo: ReturnType<typeof buildGroupRepoMock>;

  const buildGroup = (): Group =>
    new Group(
      'group-1',
      'Morumbi Runners',
      null,
      AnchorType.NEIGHBORHOOD,
      '6gyf4b',
      -23.55,
      -46.63,
      'Morumbi',
      GroupPrivacy.OPEN,
      25,
      'owner-1',
      12,
      true,
      new Date('2026-05-13T00:00:00.000Z'),
    );

  const buildDevice = (
    token: string,
    userId = 'user-2',
  ): PushRecipientDevice => ({
    userId,
    provider: PushProvider.EXPO,
    token,
  });

  beforeEach(() => {
    pushDeviceRepo = {
      upsertCurrentDevice: jest.fn(),
      listEnabledGroupMemberDevices: jest.fn(),
      listEnabledDevicesForUser: jest.fn(),
      disableCurrentDevice: jest.fn(),
      disableAllForUser: jest.fn(),
      disableByProviderToken: jest.fn(),
    };
    pushProvider = {
      provider: PushProvider.EXPO,
      validateToken: jest.fn(),
      send: jest.fn(),
    };
    digestRepo = {
      recordMessage: jest.fn().mockImplementation(
        async (
          input: RecordChatNotificationDigestInput,
        ): Promise<ChatNotificationDigestState> => ({
          recipientUserId: input.recipientUserId,
          conversationKey: input.conversationKey,
          type: input.type,
          title: input.title,
          routeData: input.routeData,
          totalCount: 1,
          snippets: [input.snippet],
          lastMessageAt: input.now,
          isReplacement: false,
        }),
      ),
      clear: jest.fn(),
    };
    groupRepo = buildGroupRepoMock();
    useCase = new SendGroupMessagePushNotificationsUseCase(
      pushDeviceRepo,
      pushProvider,
      groupRepo,
      new RecordChatNotificationDigestUseCase(digestRepo),
    );
    groupRepo.findById.mockResolvedValue(buildGroup());
    pushProvider.send.mockResolvedValue([
      { token: 'ExponentPushToken[one]', ok: true },
    ]);
  });

  it('sends a group-message push to eligible recipient devices', async () => {
    pushDeviceRepo.listEnabledGroupMemberDevices.mockResolvedValue([
      buildDevice('ExponentPushToken[one]'),
    ]);

    const result = await useCase.execute({
      groupId: 'group-1',
      messageId: 'msg-1',
      senderId: 'user-1',
      senderName: 'Alice',
      senderAvatarUrl: 'https://example.com/alice.png',
      content: '  hello   local loop  ',
      excludedUserIds: ['user-3'],
    });

    expect(pushDeviceRepo.listEnabledGroupMemberDevices).toHaveBeenCalledWith(
      'group-1',
      ['user-1', 'user-3'],
    );
    expect(pushProvider.send).toHaveBeenCalledWith(['ExponentPushToken[one]'], {
      title: 'Morumbi Runners',
      body: 'Alice: hello local loop',
      data: {
        type: 'group_message',
        conversationKey: 'group:group-1',
        groupId: 'group-1',
        groupName: 'Morumbi Runners',
        anchorType: AnchorType.NEIGHBORHOOD,
        messageId: 'msg-1',
        senderId: 'user-1',
        senderName: 'Alice',
        senderAvatarUrl: 'https://example.com/alice.png',
      },
      collapseId: 'chat:user-2:group:group-1',
      tag: 'chat:user-2:group:group-1',
      sound: 'default',
    });
    expect(result).toEqual({
      eligibleDeviceCount: 1,
      sentCount: 1,
      disabledTokenCount: 0,
    });
  });

  it('does not call the provider when there are no eligible devices', async () => {
    pushDeviceRepo.listEnabledGroupMemberDevices.mockResolvedValue([]);

    const result = await useCase.execute({
      groupId: 'group-1',
      messageId: 'msg-1',
      senderId: 'user-1',
      senderName: 'Alice',
      senderAvatarUrl: null,
      content: 'hello',
      excludedUserIds: [],
    });

    expect(pushProvider.send).not.toHaveBeenCalled();
    expect(result.sentCount).toBe(0);
  });

  it('deduplicates repeated tokens for the same recipient before sending', async () => {
    pushDeviceRepo.listEnabledGroupMemberDevices.mockResolvedValue([
      buildDevice('ExponentPushToken[one]', 'user-2'),
      buildDevice('ExponentPushToken[one]', 'user-2'),
    ]);

    await useCase.execute({
      groupId: 'group-1',
      messageId: 'msg-1',
      senderId: 'user-1',
      senderName: 'Alice',
      senderAvatarUrl: null,
      content: 'hello',
      excludedUserIds: [],
    });

    expect(pushProvider.send).toHaveBeenCalledWith(
      ['ExponentPushToken[one]'],
      expect.any(Object),
    );
  });

  it('builds a separate digest per recipient', async () => {
    pushDeviceRepo.listEnabledGroupMemberDevices.mockResolvedValue([
      buildDevice('ExponentPushToken[one]', 'user-2'),
      buildDevice('ExponentPushToken[two]', 'user-3'),
    ]);

    await useCase.execute({
      groupId: 'group-1',
      messageId: 'msg-1',
      senderId: 'user-1',
      senderName: 'Alice',
      senderAvatarUrl: null,
      content: 'hello',
      excludedUserIds: [],
    });

    expect(digestRepo.recordMessage).toHaveBeenCalledWith(
      expect.objectContaining({ recipientUserId: 'user-2' }),
    );
    expect(digestRepo.recordMessage).toHaveBeenCalledWith(
      expect.objectContaining({ recipientUserId: 'user-3' }),
    );
    expect(pushProvider.send).toHaveBeenNthCalledWith(
      1,
      ['ExponentPushToken[one]'],
      expect.objectContaining({ collapseId: 'chat:user-2:group:group-1' }),
    );
    expect(pushProvider.send).toHaveBeenNthCalledWith(
      2,
      ['ExponentPushToken[two]'],
      expect.objectContaining({ collapseId: 'chat:user-3:group:group-1' }),
    );
  });

  it('disables tokens with immediate DeviceNotRegistered ticket errors', async () => {
    pushDeviceRepo.listEnabledGroupMemberDevices.mockResolvedValue([
      buildDevice('ExponentPushToken[bad]'),
    ]);
    pushProvider.send.mockResolvedValue([
      {
        token: 'ExponentPushToken[bad]',
        ok: false,
        error: 'Device is not registered',
        errorCode: 'DeviceNotRegistered',
      },
    ]);

    const result = await useCase.execute({
      groupId: 'group-1',
      messageId: 'msg-1',
      senderId: 'user-1',
      senderName: 'Alice',
      senderAvatarUrl: null,
      content: 'hello',
      excludedUserIds: [],
    });

    expect(pushDeviceRepo.disableByProviderToken).toHaveBeenCalledWith(
      PushProvider.EXPO,
      'ExponentPushToken[bad]',
    );
    expect(result.disabledTokenCount).toBe(1);
  });

  it('truncates long message previews to 120 characters', async () => {
    pushDeviceRepo.listEnabledGroupMemberDevices.mockResolvedValue([
      buildDevice('ExponentPushToken[one]'),
    ]);

    await useCase.execute({
      groupId: 'group-1',
      messageId: 'msg-1',
      senderId: 'user-1',
      senderName: 'Alice',
      senderAvatarUrl: null,
      content: 'a'.repeat(150),
      excludedUserIds: [],
    });

    const payload = pushProvider.send.mock.calls[0][1];
    expect(payload.body.length).toBe('Alice: '.length + 120);
    expect(payload.body.endsWith('...')).toBe(true);
  });
});
