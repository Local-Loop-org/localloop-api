import { DirectMessagePayload } from '@/modules/direct-messages/application/use-cases/send-direct-message/send-direct-message.dto';

export type RealtimeEvent =
  | {
      type: 'dm_request_accepted';
      senderId: string;
      payload: DirectMessagePayload;
    }
  | {
      type: 'dm_summary_requested';
      userId: string;
      peerId: string;
    }
  | {
      type: 'dm_read';
      readerId: string;
      peerId: string;
      lastReadAt: Date;
    }
  | {
      type: 'message_deleted';
      groupId: string;
      messageId: string;
      deletedBy: string;
    }
  | {
      type: 'direct_message_deleted';
      senderId: string;
      recipientId: string;
      messageId: string;
      deletedBy: string;
    };

export type RealtimeEventHandler = (
  event: RealtimeEvent,
) => void | Promise<void>;
