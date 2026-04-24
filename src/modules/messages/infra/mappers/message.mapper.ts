import { Message } from '../../domain/entities/message.entity';
import { MessageOrmEntity } from '../repositories/message.entity';

export class MessageMapper {
  static toDomain(e: MessageOrmEntity): Message {
    return new Message(
      e.id,
      e.groupId,
      e.senderId,
      e.content,
      e.mediaUrl,
      e.mediaType,
      e.isDeleted,
      e.createdAt,
    );
  }
}
