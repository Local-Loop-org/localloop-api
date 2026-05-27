import { type PushConversationKey } from '@localloop/shared-types';

export const GROUP_ROOM_PREFIX = 'group:';
export const PRESENCE_ROOM_PREFIX = 'presence:';
export const GROUP_SUMMARY_ROOM_PREFIX = 'group_summary:';
export const DM_ROOM_PREFIX = 'dm:';
export const DM_INBOX_ROOM_PREFIX = 'dm_inbox:user:';
export const DM_PRESENCE_ROOM_PREFIX = 'dm_presence:peer:';
export const MAX_WATCHED_GROUPS = 50;

export const groupRoom = (groupId: string): string =>
  `${GROUP_ROOM_PREFIX}${groupId}`;

export const presenceRoom = (groupId: string): string =>
  `${PRESENCE_ROOM_PREFIX}${groupId}`;

export const groupSummaryRoom = (groupId: string): string =>
  `${GROUP_SUMMARY_ROOM_PREFIX}${groupId}`;

export const groupIdFromRoom = (room: string): string =>
  room.slice(GROUP_ROOM_PREFIX.length);

export const groupConversationKey = (groupId: string): PushConversationKey =>
  `group:${groupId}`;

export const dmRoom = (userAId: string, userBId: string): string => {
  const [a, b] = [userAId, userBId].sort();
  return `${DM_ROOM_PREFIX}${a}:${b}`;
};

export const dmConversationKey = (peerId: string): PushConversationKey =>
  `dm:${peerId}`;

export const dmInboxRoom = (userId: string): string =>
  `${DM_INBOX_ROOM_PREFIX}${userId}`;

export const dmPresenceRoom = (peerId: string): string =>
  `${DM_PRESENCE_ROOM_PREFIX}${peerId}`;
