jest.mock('expo-server-sdk', () => {
  const sendPushNotificationsAsync = jest.fn(async () => [
    {
      status: 'error',
      message: 'Device is not registered',
      details: { error: 'DeviceNotRegistered' },
    },
  ]);
  const Expo = jest.fn().mockImplementation(() => ({
    chunkPushNotifications: jest.fn((messages: unknown[]) => [messages]),
    sendPushNotificationsAsync,
  })) as jest.Mock & { isExpoPushToken: jest.Mock };
  Expo.isExpoPushToken = jest.fn();
  return { Expo, sendPushNotificationsAsync };
});

import { ExpoPushNotificationProvider } from '@/modules/notifications/infra/providers/expo-push-notification.provider';

const { sendPushNotificationsAsync } = jest.requireMock('expo-server-sdk') as {
  sendPushNotificationsAsync: jest.Mock;
};

describe('ExpoPushNotificationProvider', () => {
  it('preserves immediate Expo ticket error codes', async () => {
    const provider = new ExpoPushNotificationProvider();

    const results = await provider.send(['ExponentPushToken[bad]'], {
      title: 'Morumbi Runners',
      body: 'Alice: hello',
    });

    expect(results).toEqual([
      {
        token: 'ExponentPushToken[bad]',
        ok: false,
        error: 'Device is not registered',
        errorCode: 'DeviceNotRegistered',
      },
    ]);
  });

  it('forwards collapse, tag, and nullable sound options', async () => {
    const provider = new ExpoPushNotificationProvider();

    await provider.send(['ExponentPushToken[one]'], {
      title: 'Alice',
      body: 'ola',
      collapseId: 'chat:user-2:dm:user-1',
      tag: 'chat:user-2:dm:user-1',
      sound: null,
    });

    expect(sendPushNotificationsAsync).toHaveBeenCalledWith([
      expect.objectContaining({
        to: 'ExponentPushToken[one]',
        collapseId: 'chat:user-2:dm:user-1',
        tag: 'chat:user-2:dm:user-1',
        sound: null,
      }),
    ]);
  });
});
