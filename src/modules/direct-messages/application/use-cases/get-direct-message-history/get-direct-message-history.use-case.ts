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
import { GetDirectMessageHistoryResponseDto } from './get-direct-message-history.dto';

const DEFAULT_LIMIT = 50;

@Injectable()
export class GetDirectMessageHistoryUseCase {
  constructor(
    @Inject(DIRECT_MESSAGE_REPOSITORY)
    private readonly directMessageRepo: IDirectMessageRepository,
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
  ) {}

  async execute(
    callerId: string,
    otherUserId: string,
    limit?: number,
    before?: string,
  ): Promise<GetDirectMessageHistoryResponseDto> {
    if (otherUserId === callerId) {
      throw new BadRequestException({
        error: 'CANNOT_DM_SELF',
        message: 'You cannot read direct messages with yourself',
      });
    }

    const other = await this.userRepo.findById(otherUserId);
    if (!other) {
      throw new NotFoundException({
        error: 'RECIPIENT_NOT_FOUND',
        message: 'User not found',
      });
    }

    const [{ rows, nextCursor }, readState] = await Promise.all([
      this.directMessageRepo.listConversation(
        callerId,
        otherUserId,
        limit ?? DEFAULT_LIMIT,
        before,
      ),
      this.directMessageRepo.getConversationReadState(callerId, otherUserId),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        clientMessageId: null,
        senderId: row.senderId,
        senderName: row.senderName,
        senderAvatarUrl: row.senderAvatarUrl,
        recipientId: row.recipientId,
        content: row.content,
        mediaUrl: row.mediaUrl,
        mediaType: row.mediaType,
        isDeleted: row.isDeleted,
        editedAt: row.editedAt ? row.editedAt.toISOString() : null,
        replyTo: row.replyTo,
        createdAt: row.createdAt.toISOString(),
      })),
      lastReadAt: readState?.lastReadAt
        ? readState.lastReadAt.toISOString()
        : null,
      peerLastReadAt: readState?.peerLastReadAt
        ? readState.peerLastReadAt.toISOString()
        : null,
      next_cursor: nextCursor,
    };
  }
}
