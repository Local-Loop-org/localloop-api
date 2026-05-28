import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  DIRECT_MESSAGE_REPOSITORY,
  IDirectMessageRepository,
} from '@/modules/direct-messages/domain/repositories/i-direct-message.repository';
import { DeleteDirectMessageResponseDto } from './delete-direct-message.dto';

@Injectable()
export class DeleteDirectMessageUseCase {
  constructor(
    @Inject(DIRECT_MESSAGE_REPOSITORY)
    private readonly directMessageRepo: IDirectMessageRepository,
  ) {}

  async execute(
    userId: string,
    messageId: string,
  ): Promise<DeleteDirectMessageResponseDto> {
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
        message: 'You can only delete your own messages',
      });
    }

    await this.directMessageRepo.markAsDeleted(messageId);

    return {
      id: messageId,
      senderId: message.senderId,
      recipientId: message.recipientId,
      deletedBy: userId,
    };
  }
}
