import { Inject, Injectable } from '@nestjs/common';
import {
  DIRECT_MESSAGE_REPOSITORY,
  DmInboxCursor,
  IDirectMessageRepository,
} from '@/modules/direct-messages/domain/repositories/i-direct-message.repository';
import {
  encodeJsonCursor,
  parseTimestampIdCursor,
} from '@/shared/pagination/cursor.utils';
import {
  DmConversationDto,
  ListDmConversationsResponseDto,
} from './list-dm-conversations.dto';

const DEFAULT_LIMIT = 20;

@Injectable()
export class ListDmConversationsUseCase {
  constructor(
    @Inject(DIRECT_MESSAGE_REPOSITORY)
    private readonly directMessageRepo: IDirectMessageRepository,
  ) {}

  async execute(
    userId: string,
    limit?: number,
    cursor?: string,
  ): Promise<ListDmConversationsResponseDto> {
    let decodedCursor: DmInboxCursor | undefined;
    if (cursor) {
      const { timestamp, id } = parseTimestampIdCursor(
        cursor,
        'lastMessageAt',
        'peerId',
      );
      decodedCursor = { lastMessageAt: timestamp, peerId: id };
    }

    const { rows, nextCursor } = await this.directMessageRepo.listInbox(
      userId,
      limit ?? DEFAULT_LIMIT,
      decodedCursor,
    );

    const data: DmConversationDto[] = rows.map((row) => ({
      peerId: row.peerId,
      peerName: row.peerName,
      peerAvatarUrl: row.peerAvatarUrl,
      lastMessage: {
        content: row.lastMessageContent,
        senderName: row.lastMessageSenderName,
        createdAt: row.lastMessageAt.toISOString(),
      },
      unreadCount: row.unreadCount,
      archived: row.archived,
    }));

    return {
      data,
      next_cursor: nextCursor
        ? encodeJsonCursor({
            lastMessageAt: nextCursor.lastMessageAt.toISOString(),
            peerId: nextCursor.peerId,
          })
        : null,
    };
  }
}
