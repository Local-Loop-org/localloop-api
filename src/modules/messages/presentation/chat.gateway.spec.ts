import { ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  AnchorType,
  DmPermission,
  GroupPrivacy,
  ChatSocketEvents,
  MemberRole,
  MemberStatus,
  Provider,
} from '@localloop/shared-types';

import { Group } from '@/modules/groups/domain/entities/group.entity';
import { GroupMember } from '@/modules/groups/domain/entities/group-member.entity';
import { buildGroupRepoMock } from '@/modules/groups/test/group-repo.mock';
import { User } from '@/modules/auth/domain/entities/user.entity';
import { IUserRepository } from '@/modules/auth/domain/repositories/i-user.repository';
import { SendGroupMessagePushNotificationsUseCase } from '@/modules/notifications/application/use-cases/send-group-message-push-notifications/send-group-message-push-notifications.use-case';
import { SendDirectMessagePushNotificationsUseCase } from '@/modules/notifications/application/use-cases/send-direct-message-push-notifications/send-direct-message-push-notifications.use-case';
import { ClearChatNotificationDigestUseCase } from '@/modules/notifications/application/use-cases/clear-chat-notification-digest/clear-chat-notification-digest.use-case';
import { SendDirectMessageUseCase } from '@/modules/direct-messages/application/use-cases/send-direct-message/send-direct-message.use-case';
import { MarkDmReadUseCase } from '@/modules/direct-messages/application/use-cases/mark-dm-read/mark-dm-read.use-case';
import { IDirectMessageRepository } from '@/modules/direct-messages/domain/repositories/i-direct-message.repository';
import { buildDirectMessageRepoMock } from '@/modules/direct-messages/test/direct-message-repo.mock';
import { SendMessageUseCase } from '@/modules/messages/application/use-cases/send-message/send-message.use-case';
import { ChatGateway } from '@/modules/messages/presentation/chat.gateway';

type SocketMock = {
  id: string;
  handshake: { auth: { token?: string }; query: { token?: string } };
  data: { user?: User };
  rooms: Set<string>;
  disconnect: jest.Mock;
  join: jest.Mock;
  leave: jest.Mock;
  emit: jest.Mock;
  on: jest.Mock;
  fire: (event: string, ...args: unknown[]) => void;
};

type ServerMock = {
  to: jest.Mock;
  in: jest.Mock;
  fetchSockets: jest.Mock;
  use?: jest.Mock;
};

type SocketMiddleware = (
  socket: SocketMock,
  next: (err?: Error) => void,
) => Promise<void>;

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let jwtService: jest.Mocked<JwtService>;
  let userRepo: jest.Mocked<IUserRepository>;
  let groupRepo: ReturnType<typeof buildGroupRepoMock>;
  let sendMessage: jest.Mocked<SendMessageUseCase>;
  let sendGroupMessagePush: jest.Mocked<SendGroupMessagePushNotificationsUseCase>;
  let sendDirectMessage: jest.Mocked<SendDirectMessageUseCase>;
  let sendDirectMessagePush: jest.Mocked<SendDirectMessagePushNotificationsUseCase>;
  let clearChatNotificationDigest: jest.Mocked<ClearChatNotificationDigestUseCase>;
  let directMessageRepo: jest.Mocked<IDirectMessageRepository>;
  let markDmRead: jest.Mocked<MarkDmReadUseCase>;
  let server: ServerMock;
  let roomEmit: jest.Mock;

  const buildUser = (overrides: Partial<User> = {}): User =>
    Object.assign(
      new User(
        'user-1',
        'google-abc',
        Provider.GOOGLE,
        'Alice',
        null,
        null,
        DmPermission.MEMBERS,
        true,
        new Date(),
        new Date(),
      ),
      overrides,
    );

  const buildMember = (status: MemberStatus): GroupMember =>
    new GroupMember(
      'mem-1',
      'group-1',
      'user-1',
      MemberRole.MEMBER,
      status,
      new Date(),
    );

  const buildGroup = (overrides: Partial<Group> = {}): Group =>
    Object.assign(
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
        new Date(),
      ),
      overrides,
    );

  const buildSummary = () => ({
    groupId: 'group-1',
    lastActivityAt: new Date('2026-05-14T10:00:00Z'),
    lastReadAt: new Date('2026-05-14T09:00:00Z'),
    unreadCount: 2,
    lastMessage: {
      content: 'hi',
      senderName: 'Alice',
      createdAt: new Date('2026-05-14T10:00:00Z'),
    },
  });

  const roomMembers: Map<string, Set<SocketMock>> = new Map();
  const allSockets: Set<SocketMock> = new Set();

  const makeSocket = (
    token?: string,
    id = `sock-${Math.random().toString(36).slice(2, 8)}`,
  ): SocketMock => {
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const socket: SocketMock = {
      id,
      handshake: { auth: token ? { token } : {}, query: {} },
      data: {},
      rooms: new Set<string>(),
      disconnect: jest.fn(),
      join: jest.fn().mockImplementation(async (room: string) => {
        socket.rooms.add(room);
        if (!roomMembers.has(room)) roomMembers.set(room, new Set());
        roomMembers.get(room)!.add(socket);
      }),
      leave: jest.fn().mockImplementation(async (room: string) => {
        socket.rooms.delete(room);
        roomMembers.get(room)?.delete(socket);
      }),
      emit: jest.fn(),
      on: jest.fn((event: string, fn: (...args: unknown[]) => void) => {
        handlers.set(event, fn);
      }),
      fire: (event: string, ...args: unknown[]) => {
        handlers.get(event)?.(...args);
      },
    };
    allSockets.add(socket);
    return socket;
  };

  beforeEach(() => {
    jwtService = {
      verifyAsync: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;
    userRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findByProvider: jest.fn(),
      updateLastSeen: jest.fn(),
      updateGeohash: jest.fn(),
    };
    groupRepo = buildGroupRepoMock();
    sendMessage = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<SendMessageUseCase>;
    sendGroupMessagePush = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<SendGroupMessagePushNotificationsUseCase>;
    sendDirectMessage = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<SendDirectMessageUseCase>;
    sendDirectMessagePush = {
      execute: jest.fn().mockResolvedValue({
        eligibleDeviceCount: 0,
        sentCount: 0,
        disabledTokenCount: 0,
      }),
    } as unknown as jest.Mocked<SendDirectMessagePushNotificationsUseCase>;
    clearChatNotificationDigest = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ClearChatNotificationDigestUseCase>;
    directMessageRepo = buildDirectMessageRepoMock();
    markDmRead = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<MarkDmReadUseCase>;

    roomMembers.clear();
    allSockets.clear();
    roomEmit = jest.fn();
    server = {
      to: jest.fn(() => ({ emit: roomEmit })),
      in: jest.fn((room: string) => ({
        fetchSockets: () =>
          Promise.resolve(Array.from(roomMembers.get(room) ?? [])),
      })),
      fetchSockets: jest.fn(() => Promise.resolve(Array.from(allSockets))),
    };

    gateway = new ChatGateway(
      jwtService,
      userRepo,
      groupRepo,
      sendMessage,
      sendGroupMessagePush,
      sendDirectMessage,
      sendDirectMessagePush,
      clearChatNotificationDigest,
      directMessageRepo,
      markDmRead,
    );
    (gateway as unknown as { server: ServerMock }).server = server;
  });

  describe('auth middleware', () => {
    let middleware: SocketMiddleware;
    let next: jest.Mock;

    beforeEach(() => {
      const initServer = {
        ...server,
        use: jest.fn((fn: SocketMiddleware) => {
          middleware = fn;
        }),
      };
      gateway.afterInit(initServer as never);
      next = jest.fn();
    });

    it('rejects when no token is provided', async () => {
      const socket = makeSocket();
      await middleware(socket, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('rejects on invalid JWT', async () => {
      const socket = makeSocket('bad-token');
      jwtService.verifyAsync.mockRejectedValue(new Error('bad'));
      await middleware(socket, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('rejects if user is inactive', async () => {
      const socket = makeSocket('ok-token');
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1' });
      userRepo.findById.mockResolvedValue(buildUser({ isActive: false }));
      await middleware(socket, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('attaches the user on success and calls next with no error', async () => {
      const socket = makeSocket('ok-token');
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1' });
      userRepo.findById.mockResolvedValue(buildUser());
      await middleware(socket, next);
      expect(next).toHaveBeenCalledWith();
      expect(socket.data.user?.id).toBe('user-1');
    });
  });

  describe('join_group', () => {
    it('joins the room for an active member', async () => {
      const socket = makeSocket();
      socket.data.user = buildUser();
      groupRepo.findMember.mockResolvedValue(buildMember(MemberStatus.ACTIVE));

      const ack = await gateway.onJoinGroup(socket as never, {
        groupId: 'group-1',
      });

      expect(socket.join).toHaveBeenCalledWith('group:group-1');
      expect(clearChatNotificationDigest.execute).toHaveBeenCalledWith({
        recipientUserId: 'user-1',
        conversationKey: 'group:group-1',
      });
      expect(ack).toEqual({ ok: true });
    });

    it('rejects non-members with an error event', async () => {
      const socket = makeSocket();
      socket.data.user = buildUser();
      groupRepo.findMember.mockResolvedValue(null);

      const ack = await gateway.onJoinGroup(socket as never, {
        groupId: 'group-1',
      });

      expect(socket.join).not.toHaveBeenCalled();
      expect(socket.emit).toHaveBeenCalledWith(
        ChatSocketEvents.ERROR,
        expect.objectContaining({ code: 'FORBIDDEN' }),
      );
      expect(ack).toEqual({ ok: false });
    });
  });

  describe('send_message', () => {
    it('emits new_message to the group room on success', async () => {
      const socket = makeSocket();
      socket.data.user = buildUser();
      const broadcast = {
        id: 'msg-1',
        groupId: 'group-1',
        senderId: 'user-1',
        senderName: 'Alice',
        senderAvatarUrl: null,
        content: 'hi',
        mediaUrl: null,
        mediaType: null,
        createdAt: new Date().toISOString(),
      };
      sendMessage.execute.mockResolvedValue(broadcast);

      await gateway.onSendMessage(socket as never, {
        groupId: 'group-1',
        content: 'hi',
        storageKey: null,
        mediaType: null,
      });

      expect(sendMessage.execute).toHaveBeenCalledWith('user-1', 'group-1', {
        content: 'hi',
      });
      expect(server.to).toHaveBeenCalledWith('group:group-1');
      expect(roomEmit).toHaveBeenCalledWith(
        ChatSocketEvents.NEW_MESSAGE,
        broadcast,
      );
    });

    it('notifies offline group members after a successful send', async () => {
      const socket = makeSocket();
      socket.data.user = buildUser({ id: 'user-1' });
      const onlinePeer = makeSocket();
      onlinePeer.data.user = buildUser({ id: 'user-2' });
      await onlinePeer.join('group:group-1');
      const broadcast = {
        id: 'msg-1',
        groupId: 'group-1',
        senderId: 'user-1',
        senderName: 'Alice',
        senderAvatarUrl: null,
        content: 'hi',
        mediaUrl: null,
        mediaType: null,
        createdAt: new Date().toISOString(),
      };
      sendMessage.execute.mockResolvedValue(broadcast);

      await gateway.onSendMessage(socket as never, {
        groupId: 'group-1',
        content: 'hi',
        storageKey: null,
        mediaType: null,
      });
      await new Promise((resolve) => setImmediate(resolve));

      expect(sendGroupMessagePush.execute).toHaveBeenCalledWith({
        groupId: 'group-1',
        messageId: 'msg-1',
        senderId: 'user-1',
        senderName: 'Alice',
        senderAvatarUrl: null,
        content: 'hi',
        excludedUserIds: ['user-2'],
      });
    });

    it('does not fail message delivery when push fan-out rejects', async () => {
      const socket = makeSocket();
      socket.data.user = buildUser();
      const broadcast = {
        id: 'msg-1',
        groupId: 'group-1',
        senderId: 'user-1',
        senderName: 'Alice',
        senderAvatarUrl: null,
        content: 'hi',
        mediaUrl: null,
        mediaType: null,
        createdAt: new Date().toISOString(),
      };
      sendMessage.execute.mockResolvedValue(broadcast);
      sendGroupMessagePush.execute.mockRejectedValue(new Error('Expo down'));

      await gateway.onSendMessage(socket as never, {
        groupId: 'group-1',
        content: 'hi',
        storageKey: null,
        mediaType: null,
      });
      await new Promise((resolve) => setImmediate(resolve));

      expect(roomEmit).toHaveBeenCalledWith(
        ChatSocketEvents.NEW_MESSAGE,
        broadcast,
      );
      expect(socket.emit).not.toHaveBeenCalledWith(
        ChatSocketEvents.ERROR,
        expect.anything(),
      );
    });

    it('emits error event when the use case throws', async () => {
      const socket = makeSocket();
      socket.data.user = buildUser();
      sendMessage.execute.mockRejectedValue(
        new ForbiddenException({
          error: 'FORBIDDEN',
          message: 'Only active members can send messages',
        }),
      );

      await gateway.onSendMessage(socket as never, {
        groupId: 'group-1',
        content: 'hi',
        storageKey: null,
        mediaType: null,
      });

      expect(server.to).not.toHaveBeenCalled();
      expect(socket.emit).toHaveBeenCalledWith(
        ChatSocketEvents.ERROR,
        expect.objectContaining({ code: 'FORBIDDEN' }),
      );
      expect(sendGroupMessagePush.execute).not.toHaveBeenCalled();
    });
  });

  describe('presence', () => {
    it('emits presence_update with the new count after a successful join', async () => {
      const socket = makeSocket();
      socket.data.user = buildUser();
      groupRepo.findMember.mockResolvedValue(buildMember(MemberStatus.ACTIVE));

      await gateway.onJoinGroup(socket as never, { groupId: 'group-1' });

      expect(server.to).toHaveBeenCalledWith('group:group-1');
      expect(roomEmit).toHaveBeenCalledWith(ChatSocketEvents.PRESENCE_UPDATE, {
        groupId: 'group-1',
        count: 1,
      });
    });

    it('does not emit presence_update when a non-member is rejected', async () => {
      const socket = makeSocket();
      socket.data.user = buildUser();
      groupRepo.findMember.mockResolvedValue(null);

      await gateway.onJoinGroup(socket as never, { groupId: 'group-1' });

      expect(roomEmit).not.toHaveBeenCalledWith(
        ChatSocketEvents.PRESENCE_UPDATE,
        expect.anything(),
      );
    });

    it('emits decremented presence_update when a socket explicitly leaves', async () => {
      const socket = makeSocket();
      socket.data.user = buildUser();
      groupRepo.findMember.mockResolvedValue(buildMember(MemberStatus.ACTIVE));

      await gateway.onJoinGroup(socket as never, { groupId: 'group-1' });
      roomEmit.mockClear();

      await gateway.onLeaveGroup(socket as never, { groupId: 'group-1' });

      expect(roomEmit).toHaveBeenCalledWith(ChatSocketEvents.PRESENCE_UPDATE, {
        groupId: 'group-1',
        count: 0,
      });
    });

    it('emits decremented presence_update when a socket disconnects from a group room', async () => {
      const socketA = makeSocket();
      socketA.data.user = buildUser({ id: 'user-1' });
      const socketB = makeSocket();
      socketB.data.user = buildUser({ id: 'user-2' });
      groupRepo.findMember.mockResolvedValue(buildMember(MemberStatus.ACTIVE));

      gateway.handleConnection(socketA as never);
      gateway.handleConnection(socketB as never);
      await gateway.onJoinGroup(socketA as never, { groupId: 'group-1' });
      await gateway.onJoinGroup(socketB as never, { groupId: 'group-1' });
      roomEmit.mockClear();

      // Socket.IO fires `disconnecting` while rooms are still populated, then
      // clears the rooms before the next tick. Simulate that ordering so the
      // gateway's setImmediate callback observes the post-cleanup state.
      socketA.fire('disconnecting');
      socketA.rooms.delete('group:group-1');
      roomMembers.get('group:group-1')?.delete(socketA);
      await new Promise((resolve) => setImmediate(resolve));

      expect(roomEmit).toHaveBeenCalledWith(ChatSocketEvents.PRESENCE_UPDATE, {
        groupId: 'group-1',
        count: 1,
      });
    });

    it('does not schedule a presence emit when a socket disconnects with no group rooms', async () => {
      const socket = makeSocket();
      gateway.handleConnection(socket as never);

      socket.fire('disconnecting');
      await new Promise((resolve) => setImmediate(resolve));

      expect(server.in).not.toHaveBeenCalled();
      expect(roomEmit).not.toHaveBeenCalled();
    });

    it('lets an open-group non-member watch presence without joining the counted room', async () => {
      const socket = makeSocket();
      socket.data.user = buildUser();
      groupRepo.findById.mockResolvedValue(buildGroup());

      const ack = await gateway.onWatchPresence(socket as never, {
        groupIds: ['group-1'],
      });

      expect(ack).toEqual({ ok: true });
      expect(socket.join).toHaveBeenCalledWith('presence:group-1');
      expect(socket.join).not.toHaveBeenCalledWith('group:group-1');
      expect(roomEmit).toHaveBeenCalledWith(ChatSocketEvents.PRESENCE_UPDATE, {
        groupId: 'group-1',
        count: 0,
      });
    });

    it('suppresses an open group when the watcher is banned', async () => {
      const socket = makeSocket();
      socket.data.user = buildUser();
      groupRepo.findById.mockResolvedValue(buildGroup());
      groupRepo.findMember.mockResolvedValue(buildMember(MemberStatus.BANNED));

      await gateway.onWatchPresence(socket as never, {
        groupIds: ['group-1'],
      });

      expect(socket.join).not.toHaveBeenCalled();
      expect(roomEmit).not.toHaveBeenCalledWith(
        ChatSocketEvents.PRESENCE_UPDATE,
        expect.anything(),
      );
    });

    it('suppresses a closed group for a non-member watcher', async () => {
      const socket = makeSocket();
      socket.data.user = buildUser();
      groupRepo.findById.mockResolvedValue(
        buildGroup({ privacy: GroupPrivacy.APPROVAL_REQUIRED }),
      );
      groupRepo.findMember.mockResolvedValue(null);

      const ack = await gateway.onWatchPresence(socket as never, {
        groupIds: ['group-1'],
      });

      expect(ack).toEqual({ ok: true });
      expect(socket.join).not.toHaveBeenCalled();
      expect(roomEmit).not.toHaveBeenCalledWith(
        ChatSocketEvents.PRESENCE_UPDATE,
        expect.anything(),
      );
    });

    it('lets an active member watch a closed group', async () => {
      const socket = makeSocket();
      socket.data.user = buildUser();
      groupRepo.findById.mockResolvedValue(
        buildGroup({ privacy: GroupPrivacy.APPROVAL_REQUIRED }),
      );
      groupRepo.findMember.mockResolvedValue(buildMember(MemberStatus.ACTIVE));

      await gateway.onWatchPresence(socket as never, { groupIds: ['group-1'] });

      expect(socket.join).toHaveBeenCalledWith('presence:group-1');
      expect(roomEmit).toHaveBeenCalledWith(ChatSocketEvents.PRESENCE_UPDATE, {
        groupId: 'group-1',
        count: 0,
      });
    });

    it('does not let watcher sockets inflate the chat presence count', async () => {
      const watcher = makeSocket();
      watcher.data.user = buildUser();
      const chatter = makeSocket();
      chatter.data.user = buildUser({ id: 'user-2' });
      groupRepo.findById.mockResolvedValue(buildGroup());
      groupRepo.findMember.mockResolvedValue(buildMember(MemberStatus.ACTIVE));

      await gateway.onWatchPresence(watcher as never, {
        groupIds: ['group-1'],
      });
      roomEmit.mockClear();

      await gateway.onJoinGroup(chatter as never, { groupId: 'group-1' });

      expect(watcher.rooms.has('presence:group-1')).toBe(true);
      expect(watcher.rooms.has('group:group-1')).toBe(false);
      expect(roomEmit).toHaveBeenCalledWith(ChatSocketEvents.PRESENCE_UPDATE, {
        groupId: 'group-1',
        count: 1,
      });
    });

    it('leaves presence observer rooms on unwatch_presence', async () => {
      const socket = makeSocket();
      socket.data.user = buildUser();

      await gateway.onUnwatchPresence(socket as never, {
        groupIds: ['group-1', 'group-2'],
      });

      expect(socket.leave).toHaveBeenCalledWith('presence:group-1');
      expect(socket.leave).toHaveBeenCalledWith('presence:group-2');
    });
  });

  describe('group summaries', () => {
    it('lets active members watch group summaries and emits an initial update', async () => {
      const socket = makeSocket();
      socket.data.user = buildUser();
      groupRepo.findMember.mockResolvedValue(buildMember(MemberStatus.ACTIVE));
      groupRepo.getMyGroupSummary.mockResolvedValue(buildSummary());

      const ack = await gateway.onWatchGroupSummaries(socket as never, {
        groupIds: ['group-1'],
      });

      expect(ack).toEqual({ ok: true });
      expect(socket.join).toHaveBeenCalledWith('group_summary:group-1');
      expect(socket.emit).toHaveBeenCalledWith(
        ChatSocketEvents.GROUP_SUMMARY_UPDATE,
        {
          groupId: 'group-1',
          lastActivityAt: '2026-05-14T10:00:00.000Z',
          lastReadAt: '2026-05-14T09:00:00.000Z',
          unreadCount: 2,
          lastMessage: {
            content: 'hi',
            senderName: 'Alice',
            createdAt: '2026-05-14T10:00:00.000Z',
          },
        },
      );
    });

    it('suppresses summary watches for non-members', async () => {
      const socket = makeSocket();
      socket.data.user = buildUser();
      groupRepo.findMember.mockResolvedValue(null);

      await gateway.onWatchGroupSummaries(socket as never, {
        groupIds: ['group-1'],
      });

      expect(socket.join).not.toHaveBeenCalledWith('group_summary:group-1');
      expect(socket.emit).not.toHaveBeenCalledWith(
        ChatSocketEvents.GROUP_SUMMARY_UPDATE,
        expect.anything(),
      );
    });

    it('marks a group as read and returns a fresh summary', async () => {
      const socket = makeSocket();
      socket.data.user = buildUser();
      groupRepo.markGroupRead.mockResolvedValue(true);
      groupRepo.getMyGroupSummary.mockResolvedValue({
        ...buildSummary(),
        lastReadAt: new Date('2026-05-14T10:01:00Z'),
        unreadCount: 0,
      });

      const ack = await gateway.onMarkGroupRead(socket as never, {
        groupId: 'group-1',
      });

      expect(ack).toEqual({ ok: true });
      expect(groupRepo.markGroupRead).toHaveBeenCalledWith(
        'user-1',
        'group-1',
        expect.any(Date),
      );
      expect(socket.emit).toHaveBeenCalledWith(
        ChatSocketEvents.GROUP_SUMMARY_UPDATE,
        expect.objectContaining({ unreadCount: 0 }),
      );
      expect(clearChatNotificationDigest.execute).toHaveBeenCalledWith({
        recipientUserId: 'user-1',
        conversationKey: 'group:group-1',
      });
    });

    it('emits user-specific summaries to summary watchers after a send', async () => {
      const sender = makeSocket();
      sender.data.user = buildUser({ id: 'user-1' });
      const watcher = makeSocket();
      watcher.data.user = buildUser({ id: 'user-2' });
      await watcher.join('group_summary:group-1');
      const broadcast = {
        id: 'msg-1',
        groupId: 'group-1',
        senderId: 'user-1',
        senderName: 'Alice',
        senderAvatarUrl: null,
        content: 'hi',
        mediaUrl: null,
        mediaType: null,
        createdAt: '2026-05-14T10:00:00.000Z',
      };
      sendMessage.execute.mockResolvedValue(broadcast);
      groupRepo.getMyGroupSummary.mockResolvedValue(buildSummary());

      await gateway.onSendMessage(sender as never, {
        groupId: 'group-1',
        content: 'hi',
        storageKey: null,
        mediaType: null,
      });
      await new Promise((resolve) => setImmediate(resolve));

      expect(watcher.emit).toHaveBeenCalledWith(
        ChatSocketEvents.GROUP_SUMMARY_UPDATE,
        expect.objectContaining({
          groupId: 'group-1',
          unreadCount: 2,
        }),
      );
    });
  });

  describe('direct messages', () => {
    const dmRoomKey = (a: string, b: string) => `dm:${[a, b].sort().join(':')}`;
    const dmInboxRoomKey = (userId: string) => `dm_inbox:user:${userId}`;

    describe('join_dm', () => {
      it('joins the sorted-pair room and acks ok', async () => {
        const socket = makeSocket();
        socket.data.user = buildUser({ id: 'user-1' });

        const ack = await gateway.onJoinDm(socket as never, {
          userId: 'user-2',
        });

        expect(socket.join).toHaveBeenCalledWith(dmRoomKey('user-1', 'user-2'));
        expect(clearChatNotificationDigest.execute).toHaveBeenCalledWith({
          recipientUserId: 'user-1',
          conversationKey: 'dm:user-2',
        });
        expect(ack).toEqual({ ok: true });
      });

      it('produces the same room regardless of which side joins', async () => {
        const a = makeSocket();
        a.data.user = buildUser({ id: 'user-a' });
        const b = makeSocket();
        b.data.user = buildUser({ id: 'user-b' });

        await gateway.onJoinDm(a as never, { userId: 'user-b' });
        await gateway.onJoinDm(b as never, { userId: 'user-a' });

        const expected = dmRoomKey('user-a', 'user-b');
        expect(a.join).toHaveBeenCalledWith(expected);
        expect(b.join).toHaveBeenCalledWith(expected);
      });

      it('rejects joining a DM with self', async () => {
        const socket = makeSocket();
        socket.data.user = buildUser({ id: 'user-1' });

        const ack = await gateway.onJoinDm(socket as never, {
          userId: 'user-1',
        });

        expect(ack).toEqual({ ok: false });
        expect(socket.join).not.toHaveBeenCalled();
        expect(socket.emit).toHaveBeenCalledWith(
          ChatSocketEvents.ERROR,
          expect.objectContaining({ code: 'BAD_REQUEST' }),
        );
      });
    });

    describe('leave_dm', () => {
      it('leaves the sorted-pair room', async () => {
        const socket = makeSocket();
        socket.data.user = buildUser({ id: 'user-1' });

        await gateway.onLeaveDm(socket as never, { userId: 'user-2' });

        expect(socket.leave).toHaveBeenCalledWith(
          dmRoomKey('user-1', 'user-2'),
        );
      });

      it('no-ops on missing payload', async () => {
        const socket = makeSocket();
        socket.data.user = buildUser({ id: 'user-1' });

        await gateway.onLeaveDm(socket as never, { userId: '' });

        expect(socket.leave).not.toHaveBeenCalled();
      });
    });

    describe('send_dm', () => {
      it('emits new_direct_message to the sorted-pair room on success', async () => {
        const socket = makeSocket();
        socket.data.user = buildUser({ id: 'user-1' });
        const broadcast = {
          type: 'message' as const,
          id: 'dm-1',
          senderId: 'user-1',
          senderName: 'Alice',
          senderAvatarUrl: null,
          recipientId: 'user-2',
          content: 'hi',
          mediaUrl: null,
          mediaType: null,
          createdAt: new Date().toISOString(),
        };
        sendDirectMessage.execute.mockResolvedValue(broadcast);

        await gateway.onSendDm(socket as never, {
          recipientId: 'user-2',
          content: 'hi',
        });

        expect(sendDirectMessage.execute).toHaveBeenCalledWith(
          'user-1',
          'user-2',
          { content: 'hi' },
        );
        expect(server.to).toHaveBeenCalledWith(dmRoomKey('user-1', 'user-2'));
        expect(roomEmit).toHaveBeenCalledWith(
          ChatSocketEvents.NEW_DIRECT_MESSAGE,
          broadcast,
        );
        expect(socket.emit).not.toHaveBeenCalledWith(
          ChatSocketEvents.DM_REQUEST_SENT,
          expect.anything(),
        );
      });

      it('emits dm_request_sent to sender socket only when the use case returns a request', async () => {
        const socket = makeSocket();
        socket.data.user = buildUser({ id: 'user-1' });
        sendDirectMessage.execute.mockResolvedValue({
          type: 'request',
          requestId: 'req-7',
        });

        await gateway.onSendDm(socket as never, {
          recipientId: 'user-2',
          content: 'hi',
        });

        expect(socket.emit).toHaveBeenCalledWith(
          ChatSocketEvents.DM_REQUEST_SENT,
          { requestId: 'req-7' },
        );
        expect(server.to).not.toHaveBeenCalled();
        expect(roomEmit).not.toHaveBeenCalled();
      });

      it('does not leak the request payload into the dm room (no-cross-leak)', async () => {
        const sender = makeSocket(undefined, 'sock-sender');
        sender.data.user = buildUser({ id: 'user-1' });
        const observer = makeSocket(undefined, 'sock-observer');
        observer.data.user = buildUser({ id: 'user-2' });
        await observer.join(dmRoomKey('user-1', 'user-2'));
        observer.emit.mockClear();

        sendDirectMessage.execute.mockResolvedValue({
          type: 'request',
          requestId: 'req-8',
        });

        await gateway.onSendDm(sender as never, {
          recipientId: 'user-2',
          content: 'hi',
        });

        expect(observer.emit).not.toHaveBeenCalled();
        expect(server.to).not.toHaveBeenCalled();
      });

      it('emits error event and skips broadcast when the use case throws', async () => {
        const socket = makeSocket();
        socket.data.user = buildUser({ id: 'user-1' });
        sendDirectMessage.execute.mockRejectedValue(
          new ForbiddenException({
            error: 'DM_NOT_ALLOWED',
            message: "Recipient's settings do not allow direct messages",
          }),
        );

        await gateway.onSendDm(socket as never, {
          recipientId: 'user-2',
          content: 'hi',
        });

        expect(server.to).not.toHaveBeenCalled();
        expect(socket.emit).toHaveBeenCalledWith(
          ChatSocketEvents.ERROR,
          expect.objectContaining({ code: 'DM_NOT_ALLOWED' }),
        );
      });
    });

    describe('send_dm push fan-out', () => {
      const buildDmBroadcast = () => ({
        type: 'message' as const,
        id: 'dm-1',
        senderId: 'user-1',
        senderName: 'Alice',
        senderAvatarUrl: null,
        recipientId: 'user-2',
        content: 'hi',
        mediaUrl: null,
        mediaType: null,
        createdAt: new Date().toISOString(),
      });

      it('fires a push to the recipient when they are not in the DM room', async () => {
        const sender = makeSocket(undefined, 'sock-sender');
        sender.data.user = buildUser({ id: 'user-1' });
        sendDirectMessage.execute.mockResolvedValue(buildDmBroadcast());

        await gateway.onSendDm(sender as never, {
          recipientId: 'user-2',
          content: 'hi',
        });
        await new Promise((resolve) => setImmediate(resolve));

        expect(sendDirectMessagePush.execute).toHaveBeenCalledWith({
          senderId: 'user-1',
          senderName: 'Alice',
          senderAvatarUrl: null,
          recipientId: 'user-2',
          messageId: 'dm-1',
          content: 'hi',
        });
      });

      it('skips the push when the recipient already has a socket in the DM room (WS dedup)', async () => {
        const sender = makeSocket(undefined, 'sock-sender');
        sender.data.user = buildUser({ id: 'user-1' });
        const recipientSocket = makeSocket(undefined, 'sock-recipient');
        recipientSocket.data.user = buildUser({ id: 'user-2' });
        await recipientSocket.join(dmRoomKey('user-1', 'user-2'));
        sendDirectMessage.execute.mockResolvedValue(buildDmBroadcast());

        await gateway.onSendDm(sender as never, {
          recipientId: 'user-2',
          content: 'hi',
        });
        await new Promise((resolve) => setImmediate(resolve));

        expect(sendDirectMessagePush.execute).not.toHaveBeenCalled();
      });

      it('still fires the push when only the sender (not the recipient) is in the DM room', async () => {
        const sender = makeSocket(undefined, 'sock-sender');
        sender.data.user = buildUser({ id: 'user-1' });
        await sender.join(dmRoomKey('user-1', 'user-2'));
        sendDirectMessage.execute.mockResolvedValue(buildDmBroadcast());

        await gateway.onSendDm(sender as never, {
          recipientId: 'user-2',
          content: 'hi',
        });
        await new Promise((resolve) => setImmediate(resolve));

        expect(sendDirectMessagePush.execute).toHaveBeenCalledWith(
          expect.objectContaining({ recipientId: 'user-2' }),
        );
      });

      it('does not fire a push on the request branch', async () => {
        const sender = makeSocket();
        sender.data.user = buildUser({ id: 'user-1' });
        sendDirectMessage.execute.mockResolvedValue({
          type: 'request',
          requestId: 'req-9',
        });

        await gateway.onSendDm(sender as never, {
          recipientId: 'user-2',
          content: 'hi',
        });
        await new Promise((resolve) => setImmediate(resolve));

        expect(sendDirectMessagePush.execute).not.toHaveBeenCalled();
        expect(sender.emit).toHaveBeenCalledWith(
          ChatSocketEvents.DM_REQUEST_SENT,
          { requestId: 'req-9' },
        );
      });

      it('does not fail the message delivery when the push fan-out rejects', async () => {
        const sender = makeSocket();
        sender.data.user = buildUser({ id: 'user-1' });
        const broadcast = buildDmBroadcast();
        sendDirectMessage.execute.mockResolvedValue(broadcast);
        sendDirectMessagePush.execute.mockRejectedValue(new Error('Expo down'));

        await gateway.onSendDm(sender as never, {
          recipientId: 'user-2',
          content: 'hi',
        });
        await new Promise((resolve) => setImmediate(resolve));

        expect(roomEmit).toHaveBeenCalledWith(
          ChatSocketEvents.NEW_DIRECT_MESSAGE,
          broadcast,
        );
        expect(sender.emit).not.toHaveBeenCalledWith(
          ChatSocketEvents.ERROR,
          expect.anything(),
        );
      });
    });

    describe('watch_dm_inbox', () => {
      it("joins the caller's own dm inbox room", async () => {
        const socket = makeSocket();
        socket.data.user = buildUser({ id: 'user-1' });

        const ack = await gateway.onWatchDmInbox(socket as never);

        expect(socket.join).toHaveBeenCalledWith(dmInboxRoomKey('user-1'));
        expect(ack).toEqual({ ok: true });
      });

      it('two sockets of the same user both join the same room (multi-device)', async () => {
        const phone = makeSocket(undefined, 'sock-phone');
        phone.data.user = buildUser({ id: 'user-1' });
        const laptop = makeSocket(undefined, 'sock-laptop');
        laptop.data.user = buildUser({ id: 'user-1' });

        await gateway.onWatchDmInbox(phone as never);
        await gateway.onWatchDmInbox(laptop as never);

        const room = dmInboxRoomKey('user-1');
        expect(roomMembers.get(room)?.size).toBe(2);
      });
    });

    describe('unwatch_dm_inbox', () => {
      it("leaves the caller's own dm inbox room", async () => {
        const socket = makeSocket();
        socket.data.user = buildUser({ id: 'user-1' });
        await gateway.onWatchDmInbox(socket as never);

        await gateway.onUnwatchDmInbox(socket as never);

        expect(socket.leave).toHaveBeenCalledWith(dmInboxRoomKey('user-1'));
      });
    });

    describe('mark_dm_read', () => {
      const buildSummary = () => ({
        peerId: 'user-2',
        lastActivityAt: new Date('2026-05-19T10:00:00Z'),
        lastReadAt: new Date('2026-05-19T10:00:00Z'),
        unreadCount: 0,
        archived: false,
        lastMessage: {
          content: 'hi',
          senderName: 'Bob',
          createdAt: new Date('2026-05-19T10:00:00Z'),
        },
      });

      it('calls the use case then emits dm_summary_update to the caller inbox room', async () => {
        const socket = makeSocket();
        socket.data.user = buildUser({ id: 'user-1' });
        markDmRead.execute.mockResolvedValue({
          lastReadAt: new Date('2026-05-19T10:00:00Z'),
        });
        directMessageRepo.getDmSummary.mockResolvedValue(buildSummary());

        const ack = await gateway.onMarkDmRead(socket as never, {
          peerId: 'user-2',
        });

        expect(markDmRead.execute).toHaveBeenCalledWith('user-1', 'user-2');
        expect(server.to).toHaveBeenCalledWith(dmInboxRoomKey('user-1'));
        expect(roomEmit).toHaveBeenCalledWith(
          ChatSocketEvents.DM_SUMMARY_UPDATE,
          expect.objectContaining({
            peerId: 'user-2',
            unreadCount: 0,
            archived: false,
          }),
        );
        expect(clearChatNotificationDigest.execute).toHaveBeenCalledWith({
          recipientUserId: 'user-1',
          conversationKey: 'dm:user-2',
        });
        expect(ack).toEqual({ ok: true });
      });

      it('rejects self-DM with BAD_REQUEST error', async () => {
        const socket = makeSocket();
        socket.data.user = buildUser({ id: 'user-1' });

        const ack = await gateway.onMarkDmRead(socket as never, {
          peerId: 'user-1',
        });

        expect(markDmRead.execute).not.toHaveBeenCalled();
        expect(socket.emit).toHaveBeenCalledWith(
          ChatSocketEvents.ERROR,
          expect.objectContaining({ code: 'BAD_REQUEST' }),
        );
        expect(ack).toEqual({ ok: false });
      });

      it('rejects empty or missing peerId', async () => {
        const socket = makeSocket();
        socket.data.user = buildUser({ id: 'user-1' });

        const ack = await gateway.onMarkDmRead(socket as never, {
          peerId: '',
        });

        expect(markDmRead.execute).not.toHaveBeenCalled();
        expect(ack).toEqual({ ok: false });
      });

      it('does not leak summary to other users (user-scoped)', async () => {
        const socket = makeSocket();
        socket.data.user = buildUser({ id: 'user-1' });
        markDmRead.execute.mockResolvedValue({
          lastReadAt: new Date('2026-05-19T10:00:00Z'),
        });
        directMessageRepo.getDmSummary.mockResolvedValue(buildSummary());

        await gateway.onMarkDmRead(socket as never, { peerId: 'user-2' });

        expect(server.to).toHaveBeenCalledWith(dmInboxRoomKey('user-1'));
        expect(server.to).not.toHaveBeenCalledWith(dmInboxRoomKey('user-2'));
        expect(server.to).not.toHaveBeenCalledWith(dmInboxRoomKey('user-99'));
      });
    });

    describe('send_dm summary fan-out', () => {
      const buildSummary = (peerId: string, unreadCount: number) => ({
        peerId,
        lastActivityAt: new Date('2026-05-19T10:00:00Z'),
        lastReadAt: null,
        unreadCount,
        archived: false,
        lastMessage: {
          content: 'hi',
          senderName: 'Alice',
          createdAt: new Date('2026-05-19T10:00:00Z'),
        },
      });

      it('emits dm_summary_update to both sender and recipient inbox rooms on direct delivery', async () => {
        const socket = makeSocket();
        socket.data.user = buildUser({ id: 'user-1' });
        sendDirectMessage.execute.mockResolvedValue({
          type: 'message',
          id: 'dm-1',
          senderId: 'user-1',
          senderName: 'Alice',
          senderAvatarUrl: null,
          recipientId: 'user-2',
          content: 'hi',
          mediaUrl: null,
          mediaType: null,
          createdAt: new Date('2026-05-19T10:00:00Z').toISOString(),
        });
        directMessageRepo.getDmSummary.mockImplementation(
          async (userId, peerId) =>
            buildSummary(peerId, userId === 'user-1' ? 0 : 1),
        );

        await gateway.onSendDm(socket as never, {
          recipientId: 'user-2',
          content: 'hi',
        });
        // fire-and-forget: let the catch handlers settle
        await new Promise((r) => setImmediate(r));

        expect(server.to).toHaveBeenCalledWith(dmInboxRoomKey('user-1'));
        expect(server.to).toHaveBeenCalledWith(dmInboxRoomKey('user-2'));
        expect(roomEmit).toHaveBeenCalledWith(
          ChatSocketEvents.DM_SUMMARY_UPDATE,
          expect.objectContaining({ peerId: 'user-2' }),
        );
        expect(roomEmit).toHaveBeenCalledWith(
          ChatSocketEvents.DM_SUMMARY_UPDATE,
          expect.objectContaining({ peerId: 'user-1' }),
        );
      });

      it('does NOT emit dm_summary_update on the request branch', async () => {
        const socket = makeSocket();
        socket.data.user = buildUser({ id: 'user-1' });
        sendDirectMessage.execute.mockResolvedValue({
          type: 'request',
          requestId: 'req-7',
        });

        await gateway.onSendDm(socket as never, {
          recipientId: 'user-2',
          content: 'hi',
        });
        await new Promise((r) => setImmediate(r));

        expect(directMessageRepo.getDmSummary).not.toHaveBeenCalled();
        expect(roomEmit).not.toHaveBeenCalledWith(
          ChatSocketEvents.DM_SUMMARY_UPDATE,
          expect.anything(),
        );
      });
    });

    describe('emitDmSummary', () => {
      it('is silent when no message has been exchanged with the peer (getDmSummary returns null)', async () => {
        directMessageRepo.getDmSummary.mockResolvedValue(null);

        await gateway.emitDmSummary('user-1', 'user-2');

        expect(server.to).not.toHaveBeenCalled();
        expect(roomEmit).not.toHaveBeenCalled();
      });

      it('serializes Date fields to ISO strings on emit', async () => {
        const summary = {
          peerId: 'user-2',
          lastActivityAt: new Date('2026-05-19T10:00:00Z'),
          lastReadAt: new Date('2026-05-19T09:00:00Z'),
          unreadCount: 3,
          archived: true,
          lastMessage: {
            content: 'hi',
            senderName: 'Bob',
            createdAt: new Date('2026-05-19T10:00:00Z'),
          },
        };
        directMessageRepo.getDmSummary.mockResolvedValue(summary);

        await gateway.emitDmSummary('user-1', 'user-2');

        expect(roomEmit).toHaveBeenCalledWith(
          ChatSocketEvents.DM_SUMMARY_UPDATE,
          {
            peerId: 'user-2',
            lastActivityAt: '2026-05-19T10:00:00.000Z',
            lastReadAt: '2026-05-19T09:00:00.000Z',
            unreadCount: 3,
            archived: true,
            lastMessage: {
              content: 'hi',
              senderName: 'Bob',
              createdAt: '2026-05-19T10:00:00.000Z',
            },
          },
        );
      });
    });

    describe('emitDmRequestAccepted', () => {
      const buildPayload = () => ({
        id: 'dm-9',
        senderId: 'user-1',
        senderName: 'Alice',
        senderAvatarUrl: null,
        recipientId: 'user-2',
        content: 'hello',
        mediaUrl: null,
        mediaType: null,
        createdAt: new Date('2026-05-19T10:00:00Z').toISOString(),
      });

      // After DM-TASK-E the emit goes to the per-user inbox room (multi-device
      // fan-out is an implicit property of the room). Mobile MUST emit
      // `watch_dm_inbox` on connect for these sockets to receive the event.

      it("emits dm_request_accepted to the sender's inbox room", async () => {
        const payload = buildPayload();

        await gateway.emitDmRequestAccepted('user-1', payload);

        expect(server.to).toHaveBeenCalledWith(dmInboxRoomKey('user-1'));
        expect(roomEmit).toHaveBeenCalledWith(
          ChatSocketEvents.DM_REQUEST_ACCEPTED,
          payload,
        );
      });

      it("targets only the sender's room, not the recipient's", async () => {
        await gateway.emitDmRequestAccepted('user-1', buildPayload());

        expect(server.to).toHaveBeenCalledWith(dmInboxRoomKey('user-1'));
        expect(server.to).not.toHaveBeenCalledWith(dmInboxRoomKey('user-2'));
      });

      it('does not broadcast into the dm conversation room', async () => {
        await gateway.emitDmRequestAccepted('user-1', buildPayload());

        expect(server.to).not.toHaveBeenCalledWith(
          dmRoomKey('user-1', 'user-2'),
        );
      });

      it('emits exactly once regardless of how many sockets the sender has', async () => {
        // Multi-device delivery is socket.io's job (room membership); the
        // gateway only fires the single room emit.
        await gateway.emitDmRequestAccepted('user-1', buildPayload());

        expect(roomEmit).toHaveBeenCalledTimes(1);
      });
    });
  });
});
