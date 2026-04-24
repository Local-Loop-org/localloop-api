import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MemberStatus } from '@localloop/shared-types';

import {
  GROUP_REPOSITORY,
  IGroupRepository,
} from '@/modules/groups/domain/repositories/i-group.repository';
import {
  IMessageRepository,
  MESSAGE_REPOSITORY,
} from '../../../domain/repositories/i-message.repository';
import { GetMessageHistoryResponseDto } from './get-message-history.dto';

const DEFAULT_LIMIT = 50;

@Injectable()
export class GetMessageHistoryUseCase {
  constructor(
    @Inject(MESSAGE_REPOSITORY)
    private readonly messageRepo: IMessageRepository,
    @Inject(GROUP_REPOSITORY) private readonly groupRepo: IGroupRepository,
  ) {}

  async execute(
    userId: string,
    groupId: string,
    limit?: number,
    before?: string,
  ): Promise<GetMessageHistoryResponseDto> {
    const group = await this.groupRepo.findById(groupId);
    if (!group) {
      throw new NotFoundException({
        error: 'GROUP_NOT_FOUND',
        message: 'Group not found',
      });
    }

    const member = await this.groupRepo.findMember(groupId, userId);
    if (!member || member.status !== MemberStatus.ACTIVE) {
      throw new ForbiddenException({
        error: 'FORBIDDEN',
        message: 'Only active members can read messages',
      });
    }

    const { rows, nextCursor } = await this.messageRepo.listByGroup(
      groupId,
      limit ?? DEFAULT_LIMIT,
      before,
    );

    return {
      data: rows.map((row) => ({
        id: row.id,
        senderId: row.senderId,
        senderName: row.senderName,
        senderAvatar: row.senderAvatar,
        content: row.content,
        mediaUrl: row.mediaUrl,
        mediaType: row.mediaType,
        createdAt: row.createdAt.toISOString(),
      })),
      next_cursor: nextCursor,
    };
  }
}
