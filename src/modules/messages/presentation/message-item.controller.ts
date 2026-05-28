import {
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { User } from '@/modules/auth/domain/entities/user.entity';
import { RealtimeEventsService } from '@/modules/realtime-events/realtime-events.service';
import { DeleteMessageUseCase } from '../application/use-cases/delete-message/delete-message.use-case';
import { DeleteMessageResponseDto } from '../application/use-cases/delete-message/delete-message.dto';

@Controller('messages')
@UseGuards(AuthGuard('jwt'))
export class MessageItemController {
  constructor(
    private readonly deleteMessage: DeleteMessageUseCase,
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
}
