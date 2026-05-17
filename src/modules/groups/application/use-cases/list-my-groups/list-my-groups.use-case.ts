import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  GROUP_REPOSITORY,
  IGroupRepository,
  MyGroupsCursor,
} from '@domain/repositories/i-group.repository';
import {
  decodeJsonCursor,
  encodeJsonCursor,
} from '@/shared/pagination/cursor.utils';
import { ListMyGroupsResponseDto, MyGroupDto } from './list-my-groups.dto';

const DEFAULT_LIMIT = 20;

@Injectable()
export class ListMyGroupsUseCase {
  constructor(
    @Inject(GROUP_REPOSITORY) private readonly groupRepo: IGroupRepository,
  ) {}

  async execute(
    userId: string,
    limit?: number,
    cursor?: string,
  ): Promise<ListMyGroupsResponseDto> {
    let decodedCursor: MyGroupsCursor | undefined;
    if (cursor) {
      const decoded = decodeJsonCursor(cursor);
      if (
        !decoded ||
        typeof decoded !== 'object' ||
        typeof (decoded as { lastActivityAt?: unknown }).lastActivityAt !==
          'string' ||
        typeof (decoded as { groupId?: unknown }).groupId !== 'string'
      ) {
        throw new BadRequestException({
          error: 'INVALID_CURSOR',
          message: 'Cursor payload is missing required fields',
        });
      }
      const { lastActivityAt, groupId } = decoded as {
        lastActivityAt: string;
        groupId: string;
      };
      const date = new Date(lastActivityAt);
      if (Number.isNaN(date.getTime())) {
        throw new BadRequestException({
          error: 'INVALID_CURSOR',
          message: 'Cursor lastActivityAt is not a valid ISO timestamp',
        });
      }
      decodedCursor = { lastActivityAt: date, groupId };
    }

    const { rows, nextCursor } = await this.groupRepo.listMyGroupsByActivity(
      userId,
      limit ?? DEFAULT_LIMIT,
      decodedCursor,
    );

    const data: MyGroupDto[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      anchorType: row.anchorType,
      anchorLabel: row.anchorLabel,
      memberCount: row.memberCount,
      myRole: row.myRole,
      lastActivityAt: row.lastActivityAt.toISOString(),
      lastReadAt: row.lastReadAt ? row.lastReadAt.toISOString() : null,
      unreadCount: row.unreadCount,
      lastMessage: row.lastMessage
        ? {
            content: row.lastMessage.content,
            senderName: row.lastMessage.senderName,
            createdAt: row.lastMessage.createdAt.toISOString(),
          }
        : null,
    }));

    return {
      data,
      next_cursor: nextCursor
        ? encodeJsonCursor({
            lastActivityAt: nextCursor.lastActivityAt.toISOString(),
            groupId: nextCursor.groupId,
          })
        : null,
    };
  }
}
