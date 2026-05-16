import { DirectMessage } from '@/modules/direct-messages/domain/entities/direct-message.entity';
import { DirectMessageOrmEntity } from '../repositories/direct-message.entity';

export class DirectMessageMapper {
  static toDomain(e: DirectMessageOrmEntity): DirectMessage {
    return new DirectMessage(
      e.id,
      e.senderId,
      e.recipientId,
      e.content,
      e.mediaUrl,
      e.mediaType,
      e.isDeleted,
      e.createdAt,
    );
  }
}
