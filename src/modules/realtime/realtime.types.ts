import { Socket } from 'socket.io';

import { User } from '@/modules/auth/domain/entities/user.entity';

export interface JoinGroupPayload {
  groupId: string;
}

export interface WatchPresencePayload {
  groupIds: string[];
}

export interface WatchGroupSummariesPayload {
  groupIds: string[];
}

export interface MarkGroupReadPayload {
  groupId: string;
}

export interface MarkDmReadPayload {
  peerId: string;
}

export interface SendMessagePayload {
  groupId: string;
  content: string | null;
  storageKey: string | null;
  mediaType: 'image' | 'video' | null;
  replyToMessageId?: string;
  clientMessageId?: string;
}

export interface JoinDmPayload {
  userId: string;
}

export interface SendDmPayload {
  recipientId: string;
  content: string | null;
  replyToMessageId?: string;
  clientMessageId?: string;
}

export interface WatchDmPresencePayload {
  peerId: string;
}

export interface DmTypingPayload {
  recipientId: string;
  isTyping: boolean;
}

export interface AuthedSocket extends Socket {
  data: { user: User };
}
