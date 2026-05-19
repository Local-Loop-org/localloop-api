import { BadRequestException, Inject, Injectable } from '@nestjs/common';

import {
  DIRECT_MESSAGE_REPOSITORY,
  IDirectMessageRepository,
} from '@/modules/direct-messages/domain/repositories/i-direct-message.repository';

@Injectable()
export class RemoveDmExceptionUseCase {
  constructor(
    @Inject(DIRECT_MESSAGE_REPOSITORY)
    private readonly directMessageRepo: IDirectMessageRepository,
  ) {}

  async execute(callerId: string, peerId: string): Promise<void> {
    if (peerId === callerId) {
      throw new BadRequestException({
        error: 'CANNOT_EXCEPTION_SELF',
        message: 'You cannot remove yourself from your own DM exceptions',
      });
    }
    await this.directMessageRepo.removeException(callerId, peerId);
  }
}
