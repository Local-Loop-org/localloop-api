import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import {
  DIRECT_MESSAGE_REPOSITORY,
  IDirectMessageRepository,
} from '@/modules/direct-messages/domain/repositories/i-direct-message.repository';
import { AcceptDmRequestResponseDto } from './accept-dm-request.dto';

@Injectable()
export class AcceptDmRequestUseCase {
  constructor(
    @Inject(DIRECT_MESSAGE_REPOSITORY)
    private readonly directMessageRepo: IDirectMessageRepository,
  ) {}

  async execute(
    callerId: string,
    requestId: string,
  ): Promise<AcceptDmRequestResponseDto> {
    const request = await this.directMessageRepo.findRequestById(requestId);
    if (!request || request.recipientId !== callerId) {
      throw new NotFoundException({
        error: 'DM_REQUEST_NOT_FOUND',
        message: 'DM request not found',
      });
    }

    const row = await this.directMessageRepo.acceptRequestAtomic(requestId);

    return {
      id: row.id,
      senderId: row.senderId,
      senderName: row.senderName,
      senderAvatar: row.senderAvatar,
      recipientId: row.recipientId,
      content: row.content,
      mediaUrl: row.mediaUrl,
      mediaType: row.mediaType,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
