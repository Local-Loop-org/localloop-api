import { DirectMessage } from '@/modules/direct-messages/domain/entities/direct-message.entity';
import { DirectMessageOrmEntity } from '../repositories/direct-message.entity';

export class DirectMessageMapper {
  static toDomain(e: DirectMessageOrmEntity): DirectMessage {
    return new DirectMessage({
      id: e.id,
      senderId: e.senderId,
      recipientId: e.recipientId,
      content: e.content,
      mediaUrl: e.mediaUrl,
      mediaType: e.mediaType,
      isDeleted: e.isDeleted,
      replyToMessageId: e.replyToMessageId,
      editedAt: e.editedAt,
      createdAt: e.createdAt,
    });
  }
}
