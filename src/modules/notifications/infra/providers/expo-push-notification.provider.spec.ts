jest.mock('expo-server-sdk', () => {
  const Expo = jest.fn().mockImplementation(() => ({
    chunkPushNotifications: jest.fn((messages: unknown[]) => [messages]),
    sendPushNotificationsAsync: jest.fn(async () => [
      {
        status: 'error',
        message: 'Device is not registered',
        details: { error: 'DeviceNotRegistered' },
      },
    ]),
  })) as jest.Mock & { isExpoPushToken: jest.Mock };
  Expo.isExpoPushToken = jest.fn();
  return { Expo };
});

import { ExpoPushNotificationProvider } from './expo-push-notification.provider';

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
});
