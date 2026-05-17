import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { User } from '@/modules/auth/domain/entities/user.entity';
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

@Controller('dm')
@UseGuards(AuthGuard('jwt'))
export class DirectMessagesController {
  constructor(
    private readonly getHistory: GetDirectMessageHistoryUseCase,
    private readonly sendDirectMessage: SendDirectMessageUseCase,
    private readonly listDmConversations: ListDmConversationsUseCase,
    private readonly listDmRequests: ListDmRequestsUseCase,
  ) {}

  // @Get() and @Get('requests') MUST appear before @Get(':userId') so NestJS
  // does not treat the literal strings as UUID params.

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
