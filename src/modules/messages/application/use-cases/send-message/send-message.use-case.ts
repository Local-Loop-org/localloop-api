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
import { SendMessageDto, SendMessageResponseDto } from './send-message.dto';

@Injectable()
export class SendMessageUseCase {
  constructor(
    @Inject(MESSAGE_REPOSITORY)
    private readonly messageRepo: IMessageRepository,
    @Inject(GROUP_REPOSITORY) private readonly groupRepo: IGroupRepository,
  ) {}

  async execute(
    userId: string,
    groupId: string,
    dto: SendMessageDto,
  ): Promise<SendMessageResponseDto> {
    const content = dto.content?.trim() ?? null;
    if (!content) {
      throw new BadRequestException({
        error: 'EMPTY_MESSAGE',
        message: 'Message content cannot be empty',
      });
    }

    const group = await this.groupRepo.findById(groupId);
    if (!group) {
      throw new NotFoundException({
        error: 'GROUP_NOT_FOUND',
        message: 'Group not found',
      });
    }

    const member = await this.groupRepo.findMember(groupId, userId);
    if (!member || member.status !== MemberStatus.ACTIVE) {
      throw new ForbiddenException({
        error: 'FORBIDDEN',
        message: 'Only active members can send messages',
      });
    }

    if (dto.replyToMessageId) {
      const parent = await this.messageRepo.findById(dto.replyToMessageId);
      if (!parent) {
        throw new NotFoundException({
          error: 'REPLY_TARGET_NOT_FOUND',
          message: 'Reply target message not found',
        });
      }
      if (parent.groupId !== groupId) {
        throw new BadRequestException({
          error: 'REPLY_TARGET_WRONG_CONVERSATION',
          message: 'Reply target belongs to a different conversation',
        });
      }
      if (parent.isDeleted) {
        throw new BadRequestException({
          error: 'REPLY_TARGET_DELETED',
          message: 'Reply target has been deleted',
        });
      }
    }

    const message = await this.messageRepo.create({
      groupId,
      senderId: userId,
      content,
      mediaUrl: null,
      mediaType: null,
      replyToMessageId: dto.replyToMessageId ?? null,
    });

    const row = await this.messageRepo.findByIdWithSender(message.id);
    if (!row) {
      throw new Error(
        'Message was created but could not be re-fetched with sender info',
      );
    }

    return {
      id: row.id,
      clientMessageId: dto.clientMessageId ?? null,
      groupId: row.groupId,
      senderId: row.senderId,
      senderName: row.senderName,
      senderAvatarUrl: row.senderAvatarUrl,
      content: row.content,
      mediaUrl: row.mediaUrl,
      mediaType: row.mediaType,
      isDeleted: row.isDeleted,
      editedAt: row.editedAt ? row.editedAt.toISOString() : null,
      replyTo: row.replyTo,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
