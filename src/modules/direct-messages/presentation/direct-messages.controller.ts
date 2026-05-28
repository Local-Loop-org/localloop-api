import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { User } from '@/modules/auth/domain/entities/user.entity';
import { RealtimeEventsService } from '@/modules/realtime-events/realtime-events.service';
import { GetDirectMessageHistoryUseCase } from '../application/use-cases/get-direct-message-history/get-direct-message-history.use-case';
import {
  GetDirectMessageHistoryQueryDto,
  GetDirectMessageHistoryResponseDto,
} from '../application/use-cases/get-direct-message-history/get-direct-message-history.dto';
import { SendDirectMessageUseCase } from '../application/use-cases/send-direct-message/send-direct-message.use-case';
import {
  SendDirectMessageDto,
  SendDirectMessageResponseDto,
} from '../application/use-cases/send-direct-message/send-direct-message.dto';
import { ListDmConversationsUseCase } from '../application/use-cases/list-dm-conversations/list-dm-conversations.use-case';
import {
  ListDmConversationsQueryDto,
  ListDmConversationsResponseDto,
} from '../application/use-cases/list-dm-conversations/list-dm-conversations.dto';
import { ListDmRequestsUseCase } from '../application/use-cases/list-dm-requests/list-dm-requests.use-case';
import {
  ListDmRequestsQueryDto,
  ListDmRequestsResponseDto,
} from '../application/use-cases/list-dm-requests/list-dm-requests.dto';
import { AcceptDmRequestUseCase } from '../application/use-cases/accept-dm-request/accept-dm-request.use-case';
import { AcceptDmRequestResponseDto } from '../application/use-cases/accept-dm-request/accept-dm-request.dto';
import { DeclineDmRequestUseCase } from '../application/use-cases/decline-dm-request/decline-dm-request.use-case';
import { ArchiveDmConversationUseCase } from '../application/use-cases/archive-dm-conversation/archive-dm-conversation.use-case';
import { UnarchiveDmConversationUseCase } from '../application/use-cases/unarchive-dm-conversation/unarchive-dm-conversation.use-case';
import { MarkDmReadUseCase } from '../application/use-cases/mark-dm-read/mark-dm-read.use-case';
import { DeleteDirectMessageUseCase } from '../application/use-cases/delete-direct-message/delete-direct-message.use-case';
import { DeleteDirectMessageResponseDto } from '../application/use-cases/delete-direct-message/delete-direct-message.dto';

@Controller('dm')
@UseGuards(AuthGuard('jwt'))
export class DirectMessagesController {
  constructor(
    private readonly getHistory: GetDirectMessageHistoryUseCase,
    private readonly sendDirectMessage: SendDirectMessageUseCase,
    private readonly listDmConversations: ListDmConversationsUseCase,
    private readonly listDmRequests: ListDmRequestsUseCase,
    private readonly acceptDmRequest: AcceptDmRequestUseCase,
    private readonly declineDmRequest: DeclineDmRequestUseCase,
    private readonly archiveDmConversation: ArchiveDmConversationUseCase,
    private readonly unarchiveDmConversation: UnarchiveDmConversationUseCase,
    private readonly markDmRead: MarkDmReadUseCase,
    private readonly deleteDirectMessage: DeleteDirectMessageUseCase,
    private readonly realtimeEvents: RealtimeEventsService,
  ) {}

  // @Get() and @Get('requests') / @Post('requests/...') MUST appear before
  // @Get(':userId') / @Post(':userId') so NestJS does not treat the literal
  // strings as UUID params. `@Put(':userId/archive')` is a two-segment pattern
  // so it does not conflict with `@Get(':userId')`, but we keep it grouped
  // with the request routes for readability. `@Post(':userId/read')` appears
  // before `@Post(':userId')` so the literal `read` segment is never parsed as
  // a body-driven send route.

  @Get()
  async inbox(
    @Request() req: { user: User },
    @Query() query: ListDmConversationsQueryDto,
  ): Promise<ListDmConversationsResponseDto> {
    return this.listDmConversations.execute(
      req.user.id,
      query.limit,
      query.cursor,
    );
  }

  @Get('requests')
  async requests(
    @Request() req: { user: User },
    @Query() query: ListDmRequestsQueryDto,
  ): Promise<ListDmRequestsResponseDto> {
    return this.listDmRequests.execute(req.user.id, query.limit, query.cursor);
  }

  @Post('requests/:requestId/accept')
  async acceptRequest(
    @Request() req: { user: User },
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
  ): Promise<AcceptDmRequestResponseDto> {
    const payload = await this.acceptDmRequest.execute(req.user.id, requestId);
    this.realtimeEvents.emit({
      type: 'dm_request_accepted',
      senderId: payload.senderId,
      payload,
    });
    this.realtimeEvents.emit({
      type: 'dm_summary_requested',
      userId: payload.senderId,
      peerId: payload.recipientId,
    });
    this.realtimeEvents.emit({
      type: 'dm_summary_requested',
      userId: payload.recipientId,
      peerId: payload.senderId,
    });
    return payload;
  }

  @Delete('messages/:messageId')
  async deleteMessage(
    @Request() req: { user: User },
    @Param('messageId', new ParseUUIDPipe()) messageId: string,
  ): Promise<DeleteDirectMessageResponseDto> {
    const payload = await this.deleteDirectMessage.execute(
      req.user.id,
      messageId,
    );
    this.realtimeEvents.emit({
      type: 'direct_message_deleted',
      senderId: payload.senderId,
      recipientId: payload.recipientId,
      messageId: payload.id,
      deletedBy: payload.deletedBy,
    });
    return payload;
  }

  @Post('requests/:requestId/decline')
  @HttpCode(204)
  async declineRequest(
    @Request() req: { user: User },
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
  ): Promise<void> {
    await this.declineDmRequest.execute(req.user.id, requestId);
  }

  @Put(':userId/archive')
  @HttpCode(204)
  async archive(
    @Request() req: { user: User },
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<void> {
    await this.archiveDmConversation.execute(req.user.id, userId);
    this.realtimeEvents.emit({
      type: 'dm_summary_requested',
      userId: req.user.id,
      peerId: userId,
    });
  }

  @Delete(':userId/archive')
  @HttpCode(204)
  async unarchive(
    @Request() req: { user: User },
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<void> {
    await this.unarchiveDmConversation.execute(req.user.id, userId);
    this.realtimeEvents.emit({
      type: 'dm_summary_requested',
      userId: req.user.id,
      peerId: userId,
    });
  }

  @Post(':userId/read')
  @HttpCode(204)
  async markRead(
    @Request() req: { user: User },
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<void> {
    const result = await this.markDmRead.execute(req.user.id, userId);
    this.realtimeEvents.emit({
      type: 'dm_read',
      readerId: req.user.id,
      peerId: userId,
      lastReadAt: result.lastReadAt,
    });
  }

  @Get(':userId')
  async history(
    @Request() req: { user: User },
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Query() query: GetDirectMessageHistoryQueryDto,
  ): Promise<GetDirectMessageHistoryResponseDto> {
    return this.getHistory.execute(
      req.user.id,
      userId,
      query.limit,
      query.before,
    );
  }

  @Post(':userId')
  async send(
    @Request() req: { user: User },
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: SendDirectMessageDto,
  ): Promise<SendDirectMessageResponseDto> {
    return this.sendDirectMessage.execute(req.user.id, userId, dto);
  }
}
