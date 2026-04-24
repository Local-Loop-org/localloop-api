import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { User } from '@/modules/auth/domain/entities/user.entity';
import { GetMessageHistoryUseCase } from '../application/use-cases/get-message-history/get-message-history.use-case';
import {
  GetMessageHistoryQueryDto,
  GetMessageHistoryResponseDto,
} from '../application/use-cases/get-message-history/get-message-history.dto';

@Controller('groups/:id/messages')
@UseGuards(AuthGuard('jwt'))
export class MessagesController {
  constructor(private readonly getHistory: GetMessageHistoryUseCase) {}

  @Get()
  async history(
    @Request() req: { user: User },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: GetMessageHistoryQueryDto,
  ): Promise<GetMessageHistoryResponseDto> {
    return this.getHistory.execute(req.user.id, id, query.limit, query.before);
  }
}
