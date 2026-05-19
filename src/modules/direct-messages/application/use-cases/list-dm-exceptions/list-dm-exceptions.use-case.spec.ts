import {
  DmExceptionRow,
  IDirectMessageRepository,
} from '@/modules/direct-messages/domain/repositories/i-direct-message.repository';
import { buildDirectMessageRepoMock } from '@/modules/direct-messages/test/direct-message-repo.mock';
import { parseTimestampIdCursor } from '@/shared/pagination/cursor.utils';
import { ListDmExceptionsUseCase } from './list-dm-exceptions.use-case';

describe('ListDmExceptionsUseCase', () => {
  let useCase: ListDmExceptionsUseCase;
  let directMessageRepo: jest.Mocked<IDirectMessageRepository>;

  const CALLER = 'user-caller';

  const buildRow = (
    overrides: Partial<DmExceptionRow> = {},
  ): DmExceptionRow => ({
    peerId: 'peer-1',
    peerName: 'Alice',
    peerAvatarUrl: null,
    createdAt: new Date('2026-05-19T10:00:00Z'),
    ...overrides,
  });

  beforeEach(() => {
    directMessageRepo = buildDirectMessageRepoMock();
    useCase = new ListDmExceptionsUseCase(directMessageRepo);
  });

  it('returns the caller exceptions mapped to the DTO shape', async () => {
    directMessageRepo.listExceptions.mockResolvedValue({
      rows: [
        buildRow({
          peerId: 'peer-1',
          peerName: 'Alice',
          peerAvatarUrl: 'a.png',
        }),
        buildRow({
          peerId: 'peer-2',
          peerName: 'Bob',
          peerAvatarUrl: null,
          createdAt: new Date('2026-05-18T10:00:00Z'),
        }),
      ],
      nextCursor: null,
    });

    const result = await useCase.execute(CALLER);

    expect(directMessageRepo.listExceptions).toHaveBeenCalledWith(
      CALLER,
      20,
      undefined,
    );
    expect(result).toEqual({
      data: [
        {
          peerId: 'peer-1',
          displayName: 'Alice',
          avatarUrl: 'a.png',
          createdAt: '2026-05-19T10:00:00.000Z',
        },
        {
          peerId: 'peer-2',
          displayName: 'Bob',
          avatarUrl: null,
          createdAt: '2026-05-18T10:00:00.000Z',
        },
      ],
      next_cursor: null,
    });
  });

  it('returns an empty list when the caller has no exceptions', async () => {
    directMessageRepo.listExceptions.mockResolvedValue({
      rows: [],
      nextCursor: null,
    });

    const result = await useCase.execute(CALLER);

    expect(result).toEqual({ data: [], next_cursor: null });
  });

  it('encodes nextCursor as base64 JSON of {createdAt, peerId} when more rows exist', async () => {
    const cursorDate = new Date('2026-05-15T10:00:00Z');
    directMessageRepo.listExceptions.mockResolvedValue({
      rows: [buildRow()],
      nextCursor: { createdAt: cursorDate, peerId: 'peer-9' },
    });

    const result = await useCase.execute(CALLER);

    expect(result.next_cursor).toBeTruthy();
    const decoded = parseTimestampIdCursor(
      result.next_cursor!,
      'createdAt',
      'peerId',
    );
    expect(decoded.timestamp.toISOString()).toBe(cursorDate.toISOString());
    expect(decoded.id).toBe('peer-9');
  });

  it('decodes a provided cursor and passes it to the repo', async () => {
    directMessageRepo.listExceptions.mockResolvedValue({
      rows: [],
      nextCursor: null,
    });
    const cursor = Buffer.from(
      JSON.stringify({
        createdAt: '2026-05-15T10:00:00.000Z',
        peerId: 'peer-9',
      }),
      'utf8',
    ).toString('base64url');

    await useCase.execute(CALLER, 10, cursor);

    expect(directMessageRepo.listExceptions).toHaveBeenCalledWith(CALLER, 10, {
      createdAt: new Date('2026-05-15T10:00:00.000Z'),
      peerId: 'peer-9',
    });
  });

  it('uses the provided limit', async () => {
    directMessageRepo.listExceptions.mockResolvedValue({
      rows: [],
      nextCursor: null,
    });

    await useCase.execute(CALLER, 42);

    expect(directMessageRepo.listExceptions).toHaveBeenCalledWith(
      CALLER,
      42,
      undefined,
    );
  });
});
