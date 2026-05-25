import {
  type ChatPushNotificationData,
  PushProvider,
} from '@localloop/shared-types';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: ChatPushNotificationData | Record<string, unknown>;
  collapseId?: string;
  tag?: string;
  sound?: 'default' | null;
}

export interface PushSendResult {
  token: string;
  ok: boolean;
  error?: string;
  errorCode?: string;
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
