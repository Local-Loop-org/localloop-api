import { ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  DmPermission,
  MemberRole,
  MemberStatus,
  Provider,
} from '@localloop/shared-types';

import { GroupMember } from '@/modules/groups/domain/entities/group-member.entity';
import { IGroupRepository } from '@/modules/groups/domain/repositories/i-group.repository';
import { User } from '@/modules/auth/domain/entities/user.entity';
import { IUserRepository } from '@/modules/auth/domain/repositories/i-user.repository';
import { SendMessageUseCase } from '../application/use-cases/send-message/send-message.use-case';
import { ChatGateway } from './chat.gateway';

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
  let groupRepo: jest.Mocked<IGroupRepository>;
  let sendMessage: jest.Mocked<SendMessageUseCase>;
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

  const roomMembers: Map<string, Set<SocketMock>> = new Map();

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
    groupRepo = {
      createGroupWithOwner: jest.fn(),
      findById: jest.fn(),
      findNearby: jest.fn(),
      findMember: jest.fn(),
      addMember: jest.fn(),
      incrementMemberCount: jest.fn(),
      decrementMemberCount: jest.fn(),
      removeMember: jest.fn(),
      updateMemberStatus: jest.fn(),
      findPendingJoinRequest: jest.fn(),
      createJoinRequest: jest.fn(),
      listJoinRequestsByStatus: jest.fn(),
      findJoinRequestById: jest.fn(),
      updateJoinRequestStatus: jest.fn(),
      leaveGroupAtomic: jest.fn(),
      approveJoinRequestAtomic: jest.fn(),
      banMemberAtomic: jest.fn(),
      listMembersPaginated: jest.fn(),
      listMyGroupsByActivity: jest.fn(),
    };
    sendMessage = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<SendMessageUseCase>;

    roomMembers.clear();
    roomEmit = jest.fn();
    server = {
      to: jest.fn(() => ({ emit: roomEmit })),
      in: jest.fn((room: string) => ({
        fetchSockets: () =>
          Promise.resolve(Array.from(roomMembers.get(room) ?? [])),
      })),
    };

    gateway = new ChatGateway(jwtService, userRepo, groupRepo, sendMessage);
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
        'error',
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
        senderAvatar: null,
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
      expect(roomEmit).toHaveBeenCalledWith('new_message', broadcast);
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
        'error',
        expect.objectContaining({ code: 'FORBIDDEN' }),
      );
    });
  });

  describe('presence', () => {
    it('emits presence_update with the new count after a successful join', async () => {
      const socket = makeSocket();
      socket.data.user = buildUser();
      groupRepo.findMember.mockResolvedValue(buildMember(MemberStatus.ACTIVE));

      await gateway.onJoinGroup(socket as never, { groupId: 'group-1' });

      expect(server.to).toHaveBeenCalledWith('group:group-1');
      expect(roomEmit).toHaveBeenCalledWith('presence_update', {
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
        'presence_update',
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

      expect(roomEmit).toHaveBeenCalledWith('presence_update', {
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

      expect(roomEmit).toHaveBeenCalledWith('presence_update', {
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
  });
});
