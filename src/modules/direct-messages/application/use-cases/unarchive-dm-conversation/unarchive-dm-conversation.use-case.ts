import { BadRequestException, Inject, Injectable } from '@nestjs/common';

import {
  DIRECT_MESSAGE_REPOSITORY,
  IDirectMessageRepository,
} from '@/modules/direct-messages/domain/repositories/i-direct-message.repository';

@Injectable()
export class UnarchiveDmConversationUseCase {
  constructor(
    @Inject(DIRECT_MESSAGE_REPOSITORY)
    private readonly directMessageRepo: IDirectMessageRepository,
  ) {}

  async execute(callerId: string, peerId: string): Promise<void> {
    if (peerId === callerId) {
      throw new BadRequestException({
        error: 'DM_SELF_NOT_ALLOWED',
        message: 'Cannot unarchive a self-DM',
      });
    }
    await this.directMessageRepo.setArchived(callerId, peerId, false);
  }
}
