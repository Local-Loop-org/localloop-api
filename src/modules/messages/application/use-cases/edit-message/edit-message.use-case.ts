import {
  BadRequestException,
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
} from '@/modules/messages/domain/repositories/i-message.repository';
import { EditMessageDto, EditMessageResponseDto } from './edit-message.dto';

@Injectable()
export class EditMessageUseCase {
  constructor(
    @Inject(MESSAGE_REPOSITORY)
    private readonly messageRepo: IMessageRepository,
    @Inject(GROUP_REPOSITORY) private readonly groupRepo: IGroupRepository,
  ) {}

  async execute(
    userId: string,
    messageId: string,
    dto: EditMessageDto,
  ): Promise<EditMessageResponseDto> {
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

    if (message.senderId !== userId) {
      throw new ForbiddenException({
        error: 'NOT_MESSAGE_OWNER',
        message: 'You can only edit your own messages',
      });
    }

    const content = dto.content?.trim() ?? '';
    if (!content) {
      throw new BadRequestException({
        error: 'EMPTY_MESSAGE',
        message: 'Message content cannot be empty',
      });
    }

    const editedAt = new Date();
    await this.messageRepo.markAsEdited(messageId, content, editedAt);

    return {
      id: messageId,
      groupId: message.groupId,
      content,
      editedAt,
      editedBy: userId,
    };
  }
}
