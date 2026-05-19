import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import {
  DIRECT_MESSAGE_REPOSITORY,
  IDirectMessageRepository,
} from '@/modules/direct-messages/domain/repositories/i-direct-message.repository';

@Injectable()
export class DeclineDmRequestUseCase {
  constructor(
    @Inject(DIRECT_MESSAGE_REPOSITORY)
    private readonly directMessageRepo: IDirectMessageRepository,
  ) {}

  async execute(callerId: string, requestId: string): Promise<void> {
    const request = await this.directMessageRepo.findRequestById(requestId);
    if (!request) {
      return;
    }
    if (request.recipientId !== callerId) {
      throw new NotFoundException({
        error: 'DM_REQUEST_NOT_FOUND',
        message: 'DM request not found',
      });
    }
    await this.directMessageRepo.declineRequest(requestId);
  }
}
