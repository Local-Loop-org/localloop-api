import {
  AnchorType,
  GroupPrivacy,
  PushProvider,
} from '@localloop/shared-types';
import { Group } from '@/modules/groups/domain/entities/group.entity';
import { buildGroupRepoMock } from '@/modules/groups/test/group-repo.mock';
import {
  IPushDeviceRepository,
  PushRecipientDevice,
} from '../../../domain/repositories/i-push-device.repository';
import { IPushNotificationProvider } from '../../../domain/repositories/i-push-notification-provider';
import { SendGroupMessagePushNotificationsUseCase } from './send-group-message-push-notifications.use-case';

describe('SendGroupMessagePushNotificationsUseCase', () => {
  let useCase: SendGroupMessagePushNotificationsUseCase;
  let pushDeviceRepo: jest.Mocked<IPushDeviceRepository>;
  let pushProvider: jest.Mocked<IPushNotificationProvider>;
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
    groupRepo = buildGroupRepoMock();
    useCase = new SendGroupMessagePushNotificationsUseCase(
      pushDeviceRepo,
      pushProvider,
      groupRepo,
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
        groupId: 'group-1',
        messageId: 'msg-1',
        senderId: 'user-1',
      },
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
      content: 'hello',
      excludedUserIds: [],
    });

    expect(pushProvider.send).not.toHaveBeenCalled();
    expect(result.sentCount).toBe(0);
  });

  it('deduplicates tokens before sending', async () => {
    pushDeviceRepo.listEnabledGroupMemberDevices.mockResolvedValue([
      buildDevice('ExponentPushToken[one]', 'user-2'),
      buildDevice('ExponentPushToken[one]', 'user-3'),
    ]);

    await useCase.execute({
      groupId: 'group-1',
      messageId: 'msg-1',
      senderId: 'user-1',
      senderName: 'Alice',
      content: 'hello',
      excludedUserIds: [],
    });

    expect(pushProvider.send).toHaveBeenCalledWith(
      ['ExponentPushToken[one]'],
      expect.any(Object),
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
      content: 'a'.repeat(150),
      excludedUserIds: [],
    });

    const payload = pushProvider.send.mock.calls[0][1];
    expect(payload.body.length).toBe('Alice: '.length + 120);
    expect(payload.body.endsWith('...')).toBe(true);
  });
});
