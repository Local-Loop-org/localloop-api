import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  IUserRepository,
  USER_REPOSITORY,
} from '@/modules/auth/domain/repositories/i-user.repository';
import {
  DIRECT_MESSAGE_REPOSITORY,
  IDirectMessageRepository,
} from '@/modules/direct-messages/domain/repositories/i-direct-message.repository';

@Injectable()
export class AddDmExceptionUseCase {
  constructor(
    @Inject(DIRECT_MESSAGE_REPOSITORY)
    private readonly directMessageRepo: IDirectMessageRepository,
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
  ) {}

  async execute(callerId: string, peerId: string): Promise<void> {
    if (peerId === callerId) {
      throw new BadRequestException({
        error: 'CANNOT_EXCEPTION_SELF',
        message: 'You cannot add yourself to your own DM exceptions',
      });
    }

    const peer = await this.userRepo.findById(peerId);
    if (!peer || !peer.isActive) {
      throw new NotFoundException({
        error: 'PEER_NOT_FOUND',
        message: 'Peer not found',
      });
    }

    await this.directMessageRepo.addException(callerId, peerId);
  }
}
