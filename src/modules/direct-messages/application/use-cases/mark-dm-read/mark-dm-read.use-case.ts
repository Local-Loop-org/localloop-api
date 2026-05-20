import { BadRequestException, Inject, Injectable } from '@nestjs/common';

import {
  DIRECT_MESSAGE_REPOSITORY,
  IDirectMessageRepository,
} from '@/modules/direct-messages/domain/repositories/i-direct-message.repository';

export interface MarkDmReadResult {
  lastReadAt: Date;
}

@Injectable()
export class MarkDmReadUseCase {
  constructor(
    @Inject(DIRECT_MESSAGE_REPOSITORY)
    private readonly directMessageRepo: IDirectMessageRepository,
  ) {}

  async execute(callerId: string, peerId: string): Promise<MarkDmReadResult> {
    if (peerId === callerId) {
      throw new BadRequestException({
        error: 'DM_SELF_NOT_ALLOWED',
        message: 'Cannot mark a self-DM as read',
      });
    }
    const lastReadAt = await this.directMessageRepo.markRead(
      callerId,
      peerId,
      new Date(),
    );
    return { lastReadAt };
  }
}
