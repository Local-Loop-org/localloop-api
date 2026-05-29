import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { User } from '@/modules/auth/domain/entities/user.entity';
import { RealtimeEventsService } from '@/modules/realtime-events/realtime-events.service';
import { DeleteMessageUseCase } from '@/modules/messages/application/use-cases/delete-message/delete-message.use-case';
import { DeleteMessageResponseDto } from '@/modules/messages/application/use-cases/delete-message/delete-message.dto';
import { EditMessageUseCase } from '@/modules/messages/application/use-cases/edit-message/edit-message.use-case';
import {
  EditMessageDto,
  EditMessageResponseDto,
} from '@/modules/messages/application/use-cases/edit-message/edit-message.dto';

@Controller('messages')
@UseGuards(AuthGuard('jwt'))
export class MessageItemController {
  constructor(
    private readonly deleteMessage: DeleteMessageUseCase,
    private readonly editMessage: EditMessageUseCase,
    private readonly realtimeEvents: RealtimeEventsService,
  ) {}

  @Delete(':messageId')
  async delete(
    @Request() req: { user: User },
    @Param('messageId', new ParseUUIDPipe()) messageId: string,
  ): Promise<DeleteMessageResponseDto> {
    const payload = await this.deleteMessage.execute(req.user.id, messageId);
    this.realtimeEvents.emit({
      type: 'message_deleted',
      groupId: payload.groupId,
      messageId: payload.id,
      deletedBy: payload.deletedBy,
    });
    return payload;
  }

  @Patch(':messageId')
  async update(
    @Request() req: { user: User },
    @Param('messageId', new ParseUUIDPipe()) messageId: string,
    @Body() dto: EditMessageDto,
  ): Promise<EditMessageResponseDto> {
    const payload = await this.editMessage.execute(req.user.id, messageId, dto);
    this.realtimeEvents.emit({
      type: 'message_edited',
      groupId: payload.groupId,
      messageId: payload.id,
      content: payload.content,
      editedAt: payload.editedAt,
      editedBy: payload.editedBy,
    });
    return payload;
  }
}
