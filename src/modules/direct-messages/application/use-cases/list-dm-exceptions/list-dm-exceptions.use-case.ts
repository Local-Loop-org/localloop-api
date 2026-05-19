import { Inject, Injectable } from '@nestjs/common';

import {
  DIRECT_MESSAGE_REPOSITORY,
  DmExceptionCursor,
  IDirectMessageRepository,
} from '@/modules/direct-messages/domain/repositories/i-direct-message.repository';
import {
  encodeJsonCursor,
  parseTimestampIdCursor,
} from '@/shared/pagination/cursor.utils';
import {
  DmExceptionDto,
  ListDmExceptionsResponseDto,
} from './list-dm-exceptions.dto';

const DEFAULT_LIMIT = 20;

@Injectable()
export class ListDmExceptionsUseCase {
  constructor(
    @Inject(DIRECT_MESSAGE_REPOSITORY)
    private readonly directMessageRepo: IDirectMessageRepository,
  ) {}

  async execute(
    userId: string,
    limit?: number,
    cursor?: string,
  ): Promise<ListDmExceptionsResponseDto> {
    let decodedCursor: DmExceptionCursor | undefined;
    if (cursor) {
      const { timestamp, id } = parseTimestampIdCursor(
        cursor,
        'createdAt',
        'peerId',
      );
      decodedCursor = { createdAt: timestamp, peerId: id };
    }

    const { rows, nextCursor } = await this.directMessageRepo.listExceptions(
      userId,
      limit ?? DEFAULT_LIMIT,
      decodedCursor,
    );

    const data: DmExceptionDto[] = rows.map((row) => ({
      peerId: row.peerId,
      displayName: row.peerName,
      avatarUrl: row.peerAvatarUrl,
      createdAt: row.createdAt.toISOString(),
    }));

    return {
      data,
      next_cursor: nextCursor
        ? encodeJsonCursor({
            createdAt: nextCursor.createdAt.toISOString(),
            peerId: nextCursor.peerId,
          })
        : null,
    };
  }
}
