import { Injectable } from '@nestjs/common';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { PushProvider } from '@localloop/shared-types';
import {
  IPushNotificationProvider,
  PushNotificationPayload,
  PushSendResult,
} from '../../domain/repositories/i-push-notification-provider';

@Injectable()
export class ExpoPushNotificationProvider implements IPushNotificationProvider {
  readonly provider = PushProvider.EXPO;
  private readonly expo = new Expo();

  validateToken(token: string): boolean {
    return Expo.isExpoPushToken(token);
  }

  async send(
    tokens: string[],
    payload: PushNotificationPayload,
  ): Promise<PushSendResult[]> {
    const messages: ExpoPushMessage[] = tokens.map((to) => ({
      to,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      sound: 'default',
    }));

    const chunks = this.expo.chunkPushNotifications(messages);
    const results: PushSendResult[] = [];
    for (const chunk of chunks) {
      const tickets = await this.expo.sendPushNotificationsAsync(chunk);
      tickets.forEach((ticket, index) => {
        const token = chunk[index]?.to;
        const normalizedToken = Array.isArray(token) ? token[0] : token;
        results.push({
          token: normalizedToken ?? '',
          ok: ticket.status === 'ok',
          error: ticket.status === 'error' ? ticket.message : undefined,
        });
      });
    }
    return results;
  }
}
