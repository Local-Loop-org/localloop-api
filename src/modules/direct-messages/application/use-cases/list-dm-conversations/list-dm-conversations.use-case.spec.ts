import { BadRequestException } from '@nestjs/common';
import { IDirectMessageRepository } from '@/modules/direct-messages/domain/repositories/i-direct-message.repository';
import { buildDirectMessageRepoMock } from '@/modules/direct-messages/test/direct-message-repo.mock';
import { encodeJsonCursor } from '@/shared/pagination/cursor.utils';
import { ListDmConversationsUseCase } from './list-dm-conversations.use-case';

describe('ListDmConversationsUseCase', () => {
  let useCase: ListDmConversationsUseCase;
  let repo: jest.Mocked<IDirectMessageRepository>;

  const USER_ID = 'user-a';
  const PEER_ID = 'user-b';
  const LAST_MSG_AT = new Date('2026-05-17T12:00:00Z');
  const LAST_READ_AT = new Date('2026-05-17T12:03:00Z');

  const buildConversationRow = () => ({
    peerId: PEER_ID,
    peerName: 'Bob',
    peerAvatarUrl: null,
    lastMessageContent: 'hey',
    lastMessageSenderName: 'Alice',
    lastMessageAt: LAST_MSG_AT,
    lastReadAt: LAST_READ_AT,
    unreadCount: 2,
    archived: false,
  });

  beforeEach(() => {
    repo = buildDirectMessageRepoMock();
    useCase = new ListDmConversationsUseCase(repo);
  });

  it('returns conversation list with no cursor', async () => {
    repo.listInbox.mockResolvedValue({
      rows: [buildConversationRow()],
      nextCursor: null,
    });

    const result = await useCase.execute(USER_ID);

    expect(repo.listInbox).toHaveBeenCalledWith(USER_ID, 20, undefined);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual({
      peerId: PEER_ID,
      peerName: 'Bob',
      peerAvatarUrl: null,
      lastMessage: {
        content: 'hey',
        senderName: 'Alice',
        createdAt: LAST_MSG_AT.toISOString(),
      },
      lastReadAt: LAST_READ_AT.toISOString(),
      unreadCount: 2,
      archived: false,
    });
    expect(result.next_cursor).toBeNull();
  });

  it('encodes next_cursor when there are more results', async () => {
    const nextCursor = { lastMessageAt: LAST_MSG_AT, peerId: PEER_ID };
    repo.listInbox.mockResolvedValue({
      rows: [buildConversationRow()],
      nextCursor,
    });

    const result = await useCase.execute(USER_ID, 1);

    expect(result.next_cursor).toBe(
      encodeJsonCursor({
        lastMessageAt: LAST_MSG_AT.toISOString(),
        peerId: PEER_ID,
      }),
    );
  });

  it('decodes and passes cursor to repo', async () => {
    const cursor = encodeJsonCursor({
      lastMessageAt: LAST_MSG_AT.toISOString(),
      peerId: PEER_ID,
    });
    repo.listInbox.mockResolvedValue({ rows: [], nextCursor: null });

    await useCase.execute(USER_ID, 10, cursor);

    expect(repo.listInbox).toHaveBeenCalledWith(USER_ID, 10, {
      lastMessageAt: LAST_MSG_AT,
      peerId: PEER_ID,
    });
  });

  it('throws INVALID_CURSOR for malformed cursor', async () => {
    await expect(
      useCase.execute(USER_ID, 10, 'not-valid-base64'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws INVALID_CURSOR when cursor is missing required fields', async () => {
    const badCursor = encodeJsonCursor({
      lastMessageAt: LAST_MSG_AT.toISOString(),
    }); // missing peerId
    await expect(
      useCase.execute(USER_ID, 10, badCursor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws INVALID_CURSOR when timestamp field is not a valid date', async () => {
    const badCursor = encodeJsonCursor({
      lastMessageAt: 'not-a-date',
      peerId: PEER_ID,
    });
    await expect(
      useCase.execute(USER_ID, 10, badCursor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
