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

@Controller('dm')
@UseGuards(AuthGuard('jwt'))
export class DirectMessagesController {
  constructor(
    private readonly getHistory: GetDirectMessageHistoryUseCase,
    private readonly sendDirectMessage: SendDirectMessageUseCase,
  ) {}

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
