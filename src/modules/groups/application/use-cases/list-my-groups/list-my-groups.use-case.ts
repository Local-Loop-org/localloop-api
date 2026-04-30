import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  GROUP_REPOSITORY,
  IGroupRepository,
  MyGroupsCursor,
} from '../../../domain/repositories/i-group.repository';
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
    const decodedCursor = cursor ? decodeCursor(cursor) : undefined;

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
      next_cursor: nextCursor ? encodeCursor(nextCursor) : null,
    };
  }
}

function encodeCursor(cursor: MyGroupsCursor): string {
  const payload = JSON.stringify({
    lastActivityAt: cursor.lastActivityAt.toISOString(),
    groupId: cursor.groupId,
  });
  return Buffer.from(payload, 'utf8').toString('base64url');
}

function decodeCursor(raw: string): MyGroupsCursor {
  let payload: unknown;
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    payload = JSON.parse(json);
  } catch {
    throw new BadRequestException({
      error: 'INVALID_CURSOR',
      message: 'Cursor is not a valid base64url-encoded JSON payload',
    });
  }

  if (
    !payload ||
    typeof payload !== 'object' ||
    typeof (payload as { lastActivityAt?: unknown }).lastActivityAt !==
      'string' ||
    typeof (payload as { groupId?: unknown }).groupId !== 'string'
  ) {
    throw new BadRequestException({
      error: 'INVALID_CURSOR',
      message: 'Cursor payload is missing required fields',
    });
  }

  const { lastActivityAt, groupId } = payload as {
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

  return { lastActivityAt: date, groupId };
}
