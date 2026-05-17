import { Inject, Injectable } from '@nestjs/common';
import {
  GROUP_REPOSITORY,
  IGroupRepository,
  MyGroupsCursor,
} from '@domain/repositories/i-group.repository';
import {
  encodeJsonCursor,
  parseTimestampIdCursor,
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
      const { timestamp, id } = parseTimestampIdCursor(
        cursor,
        'lastActivityAt',
        'groupId',
      );
      decodedCursor = { lastActivityAt: timestamp, groupId: id };
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
