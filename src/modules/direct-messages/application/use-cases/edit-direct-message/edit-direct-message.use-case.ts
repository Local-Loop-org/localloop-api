import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  DIRECT_MESSAGE_REPOSITORY,
  IDirectMessageRepository,
} from '@/modules/direct-messages/domain/repositories/i-direct-message.repository';
import {
  EditDirectMessageDto,
  EditDirectMessageResponseDto,
} from './edit-direct-message.dto';

@Injectable()
export class EditDirectMessageUseCase {
  constructor(
    @Inject(DIRECT_MESSAGE_REPOSITORY)
    private readonly directMessageRepo: IDirectMessageRepository,
  ) {}

  async execute(
    userId: string,
    messageId: string,
    dto: EditDirectMessageDto,
  ): Promise<EditDirectMessageResponseDto> {
    const message = await this.directMessageRepo.findById(messageId);
    if (!message || message.isDeleted) {
      throw new NotFoundException({
        error: 'MESSAGE_NOT_FOUND',
        message: 'Direct message not found',
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
    await this.directMessageRepo.markAsEdited(messageId, content, editedAt);

    return {
      id: messageId,
      senderId: message.senderId,
      recipientId: message.recipientId,
      content,
      editedAt,
      editedBy: userId,
    };
  }
}
