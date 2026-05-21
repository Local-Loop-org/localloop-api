import { BadRequestException } from '@nestjs/common';

import {
  DmExceptionCandidateRow,
  IDirectMessageRepository,
} from '@/modules/direct-messages/domain/repositories/i-direct-message.repository';
import { buildDirectMessageRepoMock } from '@/modules/direct-messages/test/direct-message-repo.mock';
import { parseStringIdCursor } from '@/shared/pagination/cursor.utils';
import { ListDmExceptionCandidatesUseCase } from './list-dm-exception-candidates.use-case';

describe('ListDmExceptionCandidatesUseCase', () => {
  let useCase: ListDmExceptionCandidatesUseCase;
  let directMessageRepo: jest.Mocked<IDirectMessageRepository>;

  const CALLER = 'user-caller';

  const buildRow = (
    overrides: Partial<DmExceptionCandidateRow> = {},
  ): DmExceptionCandidateRow => ({
    userId: 'peer-1',
    displayName: 'Alice',
    avatarUrl: null,
    ...overrides,
  });

  beforeEach(() => {
    directMessageRepo = buildDirectMessageRepoMock();
    useCase = new ListDmExceptionCandidatesUseCase(directMessageRepo);
  });

  it('returns the candidates mapped to the DTO shape', async () => {
    directMessageRepo.listExceptionCandidates.mockResolvedValue({
      rows: [
        buildRow({
          userId: 'peer-1',
          displayName: 'Alice',
          avatarUrl: 'a.png',
        }),
        buildRow({ userId: 'peer-2', displayName: 'Bob' }),
      ],
      nextCursor: null,
    });

    const result = await useCase.execute(CALLER);

    expect(directMessageRepo.listExceptionCandidates).toHaveBeenCalledWith(
      CALLER,
      undefined,
      undefined,
      20,
    );
    expect(result).toEqual({
      data: [
        { userId: 'peer-1', displayName: 'Alice', avatarUrl: 'a.png' },
        { userId: 'peer-2', displayName: 'Bob', avatarUrl: null },
      ],
      next_cursor: null,
    });
  });

  it('returns an empty list when there are no candidates', async () => {
    directMessageRepo.listExceptionCandidates.mockResolvedValue({
      rows: [],
      nextCursor: null,
    });

    const result = await useCase.execute(CALLER);

    expect(result).toEqual({ data: [], next_cursor: null });
  });

  it('encodes nextCursor as base64 JSON of {displayName, userId} when more rows exist', async () => {
    directMessageRepo.listExceptionCandidates.mockResolvedValue({
      rows: [buildRow()],
      nextCursor: { displayName: 'Zoe', userId: 'peer-9' },
    });

    const result = await useCase.execute(CALLER);

    expect(result.next_cursor).toBeTruthy();
    const decoded = parseStringIdCursor(
      result.next_cursor!,
      'displayName',
      'userId',
    );
    expect(decoded.value1).toBe('Zoe');
    expect(decoded.value2).toBe('peer-9');
  });

  it('decodes a provided cursor and passes it to the repo', async () => {
    directMessageRepo.listExceptionCandidates.mockResolvedValue({
      rows: [],
      nextCursor: null,
    });
    const cursor = Buffer.from(
      JSON.stringify({ displayName: 'Mallory', userId: 'peer-9' }),
      'utf8',
    ).toString('base64url');

    await useCase.execute(CALLER, 10, cursor);

    expect(directMessageRepo.listExceptionCandidates).toHaveBeenCalledWith(
      CALLER,
      undefined,
      { displayName: 'Mallory', userId: 'peer-9' },
      10,
    );
  });

  it('throws BadRequestException on a malformed cursor', async () => {
    await expect(
      useCase.execute(CALLER, undefined, 'not-base64-json'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('trims q and passes the trimmed value to the repo', async () => {
    directMessageRepo.listExceptionCandidates.mockResolvedValue({
      rows: [],
      nextCursor: null,
    });

    await useCase.execute(CALLER, undefined, undefined, '  Alice  ');

    expect(directMessageRepo.listExceptionCandidates).toHaveBeenCalledWith(
      CALLER,
      'Alice',
      undefined,
      20,
    );
  });

  it('treats whitespace-only q as undefined', async () => {
    directMessageRepo.listExceptionCandidates.mockResolvedValue({
      rows: [],
      nextCursor: null,
    });

    await useCase.execute(CALLER, undefined, undefined, '   ');

    expect(directMessageRepo.listExceptionCandidates).toHaveBeenCalledWith(
      CALLER,
      undefined,
      undefined,
      20,
    );
  });

  it('uses the provided limit', async () => {
    directMessageRepo.listExceptionCandidates.mockResolvedValue({
      rows: [],
      nextCursor: null,
    });

    await useCase.execute(CALLER, 42);

    expect(directMessageRepo.listExceptionCandidates).toHaveBeenCalledWith(
      CALLER,
      undefined,
      undefined,
      42,
    );
  });
});
