import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DmPermission } from '@localloop/shared-types';

import {
  GROUP_REPOSITORY,
  IGroupRepository,
} from '@/modules/groups/domain/repositories/i-group.repository';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '@/modules/auth/domain/repositories/i-user.repository';
import {
  DIRECT_MESSAGE_REPOSITORY,
  IDirectMessageRepository,
} from '@/modules/direct-messages/domain/repositories/i-direct-message.repository';
import {
  SendDirectMessageDto,
  SendDirectMessageResponseDto,
} from './send-direct-message.dto';

@Injectable()
export class SendDirectMessageUseCase {
  constructor(
    @Inject(DIRECT_MESSAGE_REPOSITORY)
    private readonly directMessageRepo: IDirectMessageRepository,
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    @Inject(GROUP_REPOSITORY) private readonly groupRepo: IGroupRepository,
  ) {}

  async execute(
    senderId: string,
    recipientId: string,
    dto: SendDirectMessageDto,
  ): Promise<SendDirectMessageResponseDto> {
    if (recipientId === senderId) {
      throw new BadRequestException({
        error: 'CANNOT_DM_SELF',
        message: 'You cannot send a direct message to yourself',
      });
    }

    const content = dto.content?.trim() ?? null;
    if (!content) {
      throw new BadRequestException({
        error: 'EMPTY_MESSAGE',
        message: 'Message content cannot be empty',
      });
    }

    const recipient = await this.userRepo.findById(recipientId);
    if (!recipient || !recipient.isActive) {
      throw new NotFoundException({
        error: 'RECIPIENT_NOT_FOUND',
        message: 'Recipient not found',
      });
    }

    const route = await this.routeDm(
      senderId,
      recipient.id,
      recipient.dmPermission,
    );

    if (route === 'request') {
      const req = await this.directMessageRepo.createRequest({
        senderId,
        recipientId,
        content,
      });
      return { type: 'request', requestId: req.id };
    }

    const created = await this.directMessageRepo.create({
      senderId,
      recipientId,
      content,
      mediaUrl: null,
      mediaType: null,
    });

    const row = await this.directMessageRepo.findByIdWithSender(created.id);
    if (!row) {
      throw new Error(
        'Direct message was created but could not be re-fetched with sender info',
      );
    }

    return {
      type: 'message',
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

  private async routeDm(
    senderId: string,
    recipientId: string,
    recipientDmPermission: DmPermission,
  ): Promise<'direct' | 'request'> {
    const hasException = await this.directMessageRepo.hasPermissionException(
      recipientId,
      senderId,
    );
    if (hasException) return 'direct';

    if (recipientDmPermission === DmPermission.EVERYONE) return 'direct';

    if (recipientDmPermission === DmPermission.MEMBERS) {
      const sharesGroup = await this.groupRepo.hasSharedActiveGroup(
        senderId,
        recipientId,
      );
      return sharesGroup ? 'direct' : 'request';
    }

    // NOBODY
    return 'request';
  }
}
