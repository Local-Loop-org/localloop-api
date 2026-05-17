import { Inject, Injectable } from '@nestjs/common';
import {
  DIRECT_MESSAGE_REPOSITORY,
  DmRequestCursor,
  IDirectMessageRepository,
} from '@/modules/direct-messages/domain/repositories/i-direct-message.repository';
import {
  encodeJsonCursor,
  parseTimestampIdCursor,
} from '@/shared/pagination/cursor.utils';
import {
  DmRequestDto,
  ListDmRequestsResponseDto,
} from './list-dm-requests.dto';

const DEFAULT_LIMIT = 20;

@Injectable()
export class ListDmRequestsUseCase {
  constructor(
    @Inject(DIRECT_MESSAGE_REPOSITORY)
    private readonly directMessageRepo: IDirectMessageRepository,
  ) {}

  async execute(
    userId: string,
    limit?: number,
    cursor?: string,
  ): Promise<ListDmRequestsResponseDto> {
    let decodedCursor: DmRequestCursor | undefined;
    if (cursor) {
      const { timestamp, id } = parseTimestampIdCursor(
        cursor,
        'createdAt',
        'requestId',
      );
      decodedCursor = { createdAt: timestamp, requestId: id };
    }

    const { rows, nextCursor } = await this.directMessageRepo.listRequests(
      userId,
      limit ?? DEFAULT_LIMIT,
      decodedCursor,
    );

    const data: DmRequestDto[] = rows.map((row) => ({
      id: row.id,
      senderId: row.senderId,
      senderName: row.senderName,
      senderAvatarUrl: row.senderAvatarUrl,
      content: row.content,
      createdAt: row.createdAt.toISOString(),
    }));

    return {
      data,
      next_cursor: nextCursor
        ? encodeJsonCursor({
            createdAt: nextCursor.createdAt.toISOString(),
            requestId: nextCursor.requestId,
          })
        : null,
    };
  }
}
