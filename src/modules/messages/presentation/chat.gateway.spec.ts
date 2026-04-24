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
  disconnect: jest.Mock;
  join: jest.Mock;
  leave: jest.Mock;
  emit: jest.Mock;
};

type ServerMock = {
  to: jest.Mock;
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

  const makeSocket = (token?: string): SocketMock => ({
    id: 'sock-1',
    handshake: { auth: token ? { token } : {}, query: {} },
    data: {},
    disconnect: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
  });

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
    };
    sendMessage = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<SendMessageUseCase>;

    roomEmit = jest.fn();
    server = {
      to: jest.fn(() => ({ emit: roomEmit })),
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
});
