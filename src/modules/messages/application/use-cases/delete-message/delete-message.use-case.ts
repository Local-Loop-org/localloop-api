import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MemberRole, MemberStatus } from '@localloop/shared-types';

import {
  GROUP_REPOSITORY,
  IGroupRepository,
} from '@/modules/groups/domain/repositories/i-group.repository';
import {
  IMessageRepository,
  MESSAGE_REPOSITORY,
} from '@/modules/messages/domain/repositories/i-message.repository';
import { DeleteMessageResponseDto } from './delete-message.dto';

@Injectable()
export class DeleteMessageUseCase {
  constructor(
    @Inject(MESSAGE_REPOSITORY)
    private readonly messageRepo: IMessageRepository,
    @Inject(GROUP_REPOSITORY) private readonly groupRepo: IGroupRepository,
  ) {}

  async execute(
    userId: string,
    messageId: string,
  ): Promise<DeleteMessageResponseDto> {
    const message = await this.messageRepo.findById(messageId);
    if (!message || message.isDeleted) {
      throw new NotFoundException({
        error: 'MESSAGE_NOT_FOUND',
        message: 'Message not found',
      });
    }

    const member = await this.groupRepo.findMember(message.groupId, userId);
    if (!member || member.status !== MemberStatus.ACTIVE) {
      throw new ForbiddenException({
        error: 'FORBIDDEN',
        message: 'Not an active member of this group',
      });
    }

    const isAuthor = message.senderId === userId;
    const isModerator =
      member.role === MemberRole.OWNER || member.role === MemberRole.MODERATOR;
    if (!isAuthor && !isModerator) {
      throw new ForbiddenException({
        error: 'NOT_ALLOWED',
        message: 'You cannot delete this message',
      });
    }

    await this.messageRepo.markAsDeleted(messageId);

    return {
      id: messageId,
      groupId: message.groupId,
      deletedBy: userId,
    };
  }
}
