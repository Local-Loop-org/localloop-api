import { Message } from '@/modules/messages/domain/entities/message.entity';
import { MessageOrmEntity } from '../repositories/message.entity';

export class MessageMapper {
  static toDomain(e: MessageOrmEntity): Message {
    return new Message({
      id: e.id,
      groupId: e.groupId,
      senderId: e.senderId,
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
