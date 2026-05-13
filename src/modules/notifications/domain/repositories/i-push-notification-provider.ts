import { PushProvider } from '@localloop/shared-types';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string | number | boolean | null>;
}

export interface PushSendResult {
  token: string;
  ok: boolean;
  error?: string;
}

export interface IPushNotificationProvider {
  readonly provider: PushProvider;
  validateToken(token: string): boolean;
  send(
    tokens: string[],
    payload: PushNotificationPayload,
  ): Promise<PushSendResult[]>;
}

export const PUSH_NOTIFICATION_PROVIDER = Symbol('PUSH_NOTIFICATION_PROVIDER');
