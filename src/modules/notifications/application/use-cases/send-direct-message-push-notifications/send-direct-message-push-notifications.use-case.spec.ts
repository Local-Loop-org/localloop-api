import { PushProvider } from '@localloop/shared-types';
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
import { RecordChatNotificationDigestUseCase } from '../record-chat-notification-digest/record-chat-notification-digest.use-case';
import { SendDirectMessagePushNotificationsUseCase } from './send-direct-message-push-notifications.use-case';

describe('SendDirectMessagePushNotificationsUseCase', () => {
  let useCase: SendDirectMessagePushNotificationsUseCase;
  let pushDeviceRepo: jest.Mocked<IPushDeviceRepository>;
  let pushProvider: jest.Mocked<IPushNotificationProvider>;
  let digestRepo: jest.Mocked<IChatNotificationDigestRepository>;

  const buildDevice = (
    token: string,
    userId = 'user-2',
    provider: PushProvider = PushProvider.EXPO,
  ): PushRecipientDevice => ({ userId, provider, token });

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
      send: jest
        .fn()
        .mockResolvedValue([{ token: 'ExponentPushToken[one]', ok: true }]),
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
    useCase = new SendDirectMessagePushNotificationsUseCase(
      pushDeviceRepo,
      pushProvider,
      new RecordChatNotificationDigestUseCase(digestRepo),
    );
  });

  it('sends a direct-message push to the recipient devices with the expected payload', async () => {
    pushDeviceRepo.listEnabledDevicesForUser.mockResolvedValue([
      buildDevice('ExponentPushToken[one]'),
    ]);

    const result = await useCase.execute({
      senderId: 'user-1',
      senderName: 'Alice',
      senderAvatarUrl: 'https://example.com/alice.png',
      recipientId: 'user-2',
      messageId: 'dm-1',
      content: '  hello   local loop  ',
    });

    expect(pushDeviceRepo.listEnabledDevicesForUser).toHaveBeenCalledWith(
      'user-2',
    );
    expect(pushProvider.send).toHaveBeenCalledWith(['ExponentPushToken[one]'], {
      title: 'Alice',
      body: 'hello local loop',
      data: {
        type: 'direct_message',
        conversationKey: 'dm:user-1',
        peerId: 'user-1',
        peerName: 'Alice',
        peerAvatarUrl: 'https://example.com/alice.png',
        messageId: 'dm-1',
      },
      collapseId: 'chat:user-2:dm:user-1',
      tag: 'chat:user-2:dm:user-1',
      sound: 'default',
    });
    expect(result).toEqual({
      eligibleDeviceCount: 1,
      sentCount: 1,
      disabledTokenCount: 0,
    });
  });

  it('does not call the provider when there are no eligible devices', async () => {
    pushDeviceRepo.listEnabledDevicesForUser.mockResolvedValue([]);

    const result = await useCase.execute({
      senderId: 'user-1',
      senderName: 'Alice',
      senderAvatarUrl: null,
      recipientId: 'user-2',
      messageId: 'dm-1',
      content: 'hi',
    });

    expect(pushProvider.send).not.toHaveBeenCalled();
    expect(result).toEqual({
      eligibleDeviceCount: 0,
      sentCount: 0,
      disabledTokenCount: 0,
    });
  });

  it('ignores devices for other providers', async () => {
    pushDeviceRepo.listEnabledDevicesForUser.mockResolvedValue([
      buildDevice('ExponentPushToken[one]', 'user-2', PushProvider.EXPO),
      buildDevice('fcm-token', 'user-2', 'fcm' as PushProvider),
    ]);

    await useCase.execute({
      senderId: 'user-1',
      senderName: 'Alice',
      senderAvatarUrl: null,
      recipientId: 'user-2',
      messageId: 'dm-1',
      content: 'hi',
    });

    expect(pushProvider.send).toHaveBeenCalledWith(
      ['ExponentPushToken[one]'],
      expect.any(Object),
    );
  });

  it('deduplicates repeated tokens across devices before sending', async () => {
    pushDeviceRepo.listEnabledDevicesForUser.mockResolvedValue([
      buildDevice('ExponentPushToken[one]'),
      buildDevice('ExponentPushToken[one]'),
    ]);

    await useCase.execute({
      senderId: 'user-1',
      senderName: 'Alice',
      senderAvatarUrl: null,
      recipientId: 'user-2',
      messageId: 'dm-1',
      content: 'hi',
    });

    expect(pushProvider.send).toHaveBeenCalledWith(
      ['ExponentPushToken[one]'],
      expect.any(Object),
    );
  });

  it('disables tokens that come back with DeviceNotRegistered ticket errors', async () => {
    pushDeviceRepo.listEnabledDevicesForUser.mockResolvedValue([
      buildDevice('ExponentPushToken[bad]'),
      buildDevice('ExponentPushToken[ok]'),
    ]);
    pushProvider.send.mockResolvedValue([
      {
        token: 'ExponentPushToken[bad]',
        ok: false,
        error: 'Device is not registered',
        errorCode: 'DeviceNotRegistered',
      },
      { token: 'ExponentPushToken[ok]', ok: true },
    ]);

    const result = await useCase.execute({
      senderId: 'user-1',
      senderName: 'Alice',
      senderAvatarUrl: null,
      recipientId: 'user-2',
      messageId: 'dm-1',
      content: 'hi',
    });

    expect(pushDeviceRepo.disableByProviderToken).toHaveBeenCalledWith(
      PushProvider.EXPO,
      'ExponentPushToken[bad]',
    );
    expect(result).toEqual({
      eligibleDeviceCount: 2,
      sentCount: 1,
      disabledTokenCount: 1,
    });
  });

  it('truncates long previews to 120 characters with a trailing ellipsis', async () => {
    pushDeviceRepo.listEnabledDevicesForUser.mockResolvedValue([
      buildDevice('ExponentPushToken[one]'),
    ]);

    await useCase.execute({
      senderId: 'user-1',
      senderName: 'Alice',
      senderAvatarUrl: null,
      recipientId: 'user-2',
      messageId: 'dm-1',
      content: 'a'.repeat(150),
    });

    const payload = pushProvider.send.mock.calls[0][1];
    expect(payload.body.length).toBe(120);
    expect(payload.body.endsWith('...')).toBe(true);
  });

  it('collapses whitespace in the preview', async () => {
    pushDeviceRepo.listEnabledDevicesForUser.mockResolvedValue([
      buildDevice('ExponentPushToken[one]'),
    ]);

    await useCase.execute({
      senderId: 'user-1',
      senderName: 'Alice',
      senderAvatarUrl: null,
      recipientId: 'user-2',
      messageId: 'dm-1',
      content: 'a\n\nb',
    });

    expect(pushProvider.send).toHaveBeenCalledWith(
      ['ExponentPushToken[one]'],
      expect.objectContaining({ body: 'a b' }),
    );
  });

  it('falls back to "Nova mensagem" when content is null or only whitespace', async () => {
    pushDeviceRepo.listEnabledDevicesForUser.mockResolvedValue([
      buildDevice('ExponentPushToken[one]'),
    ]);

    await useCase.execute({
      senderId: 'user-1',
      senderName: 'Alice',
      senderAvatarUrl: null,
      recipientId: 'user-2',
      messageId: 'dm-1',
      content: null,
    });

    expect(pushProvider.send).toHaveBeenCalledWith(
      ['ExponentPushToken[one]'],
      expect.objectContaining({ body: 'Nova mensagem' }),
    );

    pushProvider.send.mockClear();
    await useCase.execute({
      senderId: 'user-1',
      senderName: 'Alice',
      senderAvatarUrl: null,
      recipientId: 'user-2',
      messageId: 'dm-2',
      content: '   ',
    });

    expect(pushProvider.send).toHaveBeenCalledWith(
      ['ExponentPushToken[one]'],
      expect.objectContaining({ body: 'Nova mensagem' }),
    );
  });

  it('falls back to "Alguém" when senderName is empty', async () => {
    pushDeviceRepo.listEnabledDevicesForUser.mockResolvedValue([
      buildDevice('ExponentPushToken[one]'),
    ]);

    await useCase.execute({
      senderId: 'user-1',
      senderName: '   ',
      senderAvatarUrl: null,
      recipientId: 'user-2',
      messageId: 'dm-1',
      content: 'hi',
    });

    expect(pushProvider.send).toHaveBeenCalledWith(
      ['ExponentPushToken[one]'],
      expect.objectContaining({ title: 'Alguém' }),
    );
  });
});
