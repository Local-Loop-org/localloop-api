import { BadRequestException } from '@nestjs/common';
import { IDirectMessageRepository } from '@/modules/direct-messages/domain/repositories/i-direct-message.repository';
import { buildDirectMessageRepoMock } from '@/modules/direct-messages/test/direct-message-repo.mock';
import { encodeJsonCursor } from '@/shared/pagination/cursor.utils';
import { ListDmRequestsUseCase } from './list-dm-requests.use-case';

describe('ListDmRequestsUseCase', () => {
  let useCase: ListDmRequestsUseCase;
  let repo: jest.Mocked<IDirectMessageRepository>;

  const USER_ID = 'user-a';
  const SENDER_ID = 'user-b';
  const CREATED_AT = new Date('2026-05-17T08:00:00Z');

  const buildRequestRow = () => ({
    id: 'req-1',
    senderId: SENDER_ID,
    senderName: 'Bob',
    senderAvatarUrl: null,
    content: 'hey can we chat?',
    createdAt: CREATED_AT,
  });

  beforeEach(() => {
    repo = buildDirectMessageRepoMock();
    useCase = new ListDmRequestsUseCase(repo);
  });

  it('returns requests list with no cursor', async () => {
    repo.listRequests.mockResolvedValue({
      rows: [buildRequestRow()],
      nextCursor: null,
    });

    const result = await useCase.execute(USER_ID);

    expect(repo.listRequests).toHaveBeenCalledWith(USER_ID, 20, undefined);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual({
      id: 'req-1',
      senderId: SENDER_ID,
      senderName: 'Bob',
      senderAvatarUrl: null,
      content: 'hey can we chat?',
      createdAt: CREATED_AT.toISOString(),
    });
    expect(result.next_cursor).toBeNull();
  });

  it('encodes next_cursor when there are more results', async () => {
    const nextCursor = { createdAt: CREATED_AT, requestId: 'req-1' };
    repo.listRequests.mockResolvedValue({
      rows: [buildRequestRow()],
      nextCursor,
    });

    const result = await useCase.execute(USER_ID, 1);

    expect(result.next_cursor).toBe(
      encodeJsonCursor({
        createdAt: CREATED_AT.toISOString(),
        requestId: 'req-1',
      }),
    );
  });

  it('decodes and passes cursor to repo', async () => {
    const cursor = encodeJsonCursor({
      createdAt: CREATED_AT.toISOString(),
      requestId: 'req-1',
    });
    repo.listRequests.mockResolvedValue({ rows: [], nextCursor: null });

    await useCase.execute(USER_ID, 10, cursor);

    expect(repo.listRequests).toHaveBeenCalledWith(USER_ID, 10, {
      createdAt: CREATED_AT,
      requestId: 'req-1',
    });
  });

  it('throws INVALID_CURSOR for malformed cursor', async () => {
    await expect(
      useCase.execute(USER_ID, 10, 'not-valid-base64!!'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws INVALID_CURSOR when cursor is missing required fields', async () => {
    const badCursor = encodeJsonCursor({ createdAt: CREATED_AT.toISOString() }); // missing requestId
    await expect(
      useCase.execute(USER_ID, 10, badCursor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
