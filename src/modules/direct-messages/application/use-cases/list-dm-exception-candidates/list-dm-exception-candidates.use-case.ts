import { Inject, Injectable } from '@nestjs/common';

import {
  DIRECT_MESSAGE_REPOSITORY,
  DmExceptionCandidateCursor,
  IDirectMessageRepository,
} from '@/modules/direct-messages/domain/repositories/i-direct-message.repository';
import {
  encodeJsonCursor,
  parseStringIdCursor,
} from '@/shared/pagination/cursor.utils';
import {
  DmExceptionCandidateDto,
  ListDmExceptionCandidatesResponseDto,
} from './list-dm-exception-candidates.dto';

const DEFAULT_LIMIT = 20;

@Injectable()
export class ListDmExceptionCandidatesUseCase {
  constructor(
    @Inject(DIRECT_MESSAGE_REPOSITORY)
    private readonly directMessageRepo: IDirectMessageRepository,
  ) {}

  async execute(
    userId: string,
    limit?: number,
    cursor?: string,
    q?: string,
  ): Promise<ListDmExceptionCandidatesResponseDto> {
    let decodedCursor: DmExceptionCandidateCursor | undefined;
    if (cursor) {
      const { value1, value2 } = parseStringIdCursor(
        cursor,
        'displayName',
        'userId',
      );
      decodedCursor = { displayName: value1, userId: value2 };
    }

    const trimmedQ = q?.trim();
    const effectiveQ =
      trimmedQ !== undefined && trimmedQ.length > 0 ? trimmedQ : undefined;

    const { rows, nextCursor } =
      await this.directMessageRepo.listExceptionCandidates(
        userId,
        effectiveQ,
        decodedCursor,
        limit ?? DEFAULT_LIMIT,
      );

    const data: DmExceptionCandidateDto[] = rows.map((row) => ({
      userId: row.userId,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
    }));

    return {
      data,
      next_cursor: nextCursor
        ? encodeJsonCursor({
            displayName: nextCursor.displayName,
            userId: nextCursor.userId,
          })
        : null,
    };
  }
}
