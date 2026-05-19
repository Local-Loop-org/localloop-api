import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { User } from '@/modules/auth/domain/entities/user.entity';
import { ListDmExceptionsUseCase } from '../application/use-cases/list-dm-exceptions/list-dm-exceptions.use-case';
import {
  ListDmExceptionsQueryDto,
  ListDmExceptionsResponseDto,
} from '../application/use-cases/list-dm-exceptions/list-dm-exceptions.dto';
import { AddDmExceptionUseCase } from '../application/use-cases/add-dm-exception/add-dm-exception.use-case';
import { RemoveDmExceptionUseCase } from '../application/use-cases/remove-dm-exception/remove-dm-exception.use-case';

@Controller('users/me/dm-exceptions')
@UseGuards(AuthGuard('jwt'))
export class DmExceptionsController {
  constructor(
    private readonly listExceptions: ListDmExceptionsUseCase,
    private readonly addException: AddDmExceptionUseCase,
    private readonly removeException: RemoveDmExceptionUseCase,
  ) {}

  @Get()
  async list(
    @Request() req: { user: User },
    @Query() query: ListDmExceptionsQueryDto,
  ): Promise<ListDmExceptionsResponseDto> {
    return this.listExceptions.execute(req.user.id, query.limit, query.cursor);
  }

  @Put(':peerId')
  @HttpCode(204)
  async add(
    @Request() req: { user: User },
    @Param('peerId', new ParseUUIDPipe()) peerId: string,
  ): Promise<void> {
    await this.addException.execute(req.user.id, peerId);
  }

  @Delete(':peerId')
  @HttpCode(204)
  async remove(
    @Request() req: { user: User },
    @Param('peerId', new ParseUUIDPipe()) peerId: string,
  ): Promise<void> {
    await this.removeException.execute(req.user.id, peerId);
  }
}
