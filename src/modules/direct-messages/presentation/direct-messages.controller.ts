import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { User } from '@/modules/auth/domain/entities/user.entity';
import { ChatGateway } from '@/modules/messages/presentation/chat.gateway';
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
    private readonly chatGateway: ChatGateway,
  ) {}

  // @Get() and @Get('requests') / @Post('requests/...') MUST appear before
  // @Get(':userId') / @Post(':userId') so NestJS does not treat the literal
  // strings as UUID params.

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
    await this.chatGateway.emitDmRequestAccepted(payload.senderId, payload);
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
