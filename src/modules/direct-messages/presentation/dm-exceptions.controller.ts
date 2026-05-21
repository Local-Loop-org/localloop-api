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
import { ListDmExceptionCandidatesUseCase } from '../application/use-cases/list-dm-exception-candidates/list-dm-exception-candidates.use-case';
import {
  ListDmExceptionCandidatesQueryDto,
  ListDmExceptionCandidatesResponseDto,
} from '../application/use-cases/list-dm-exception-candidates/list-dm-exception-candidates.dto';

@Controller('users/me')
@UseGuards(AuthGuard('jwt'))
export class DmExceptionsController {
  constructor(
    private readonly listExceptions: ListDmExceptionsUseCase,
    private readonly addException: AddDmExceptionUseCase,
    private readonly removeException: RemoveDmExceptionUseCase,
    private readonly listCandidates: ListDmExceptionCandidatesUseCase,
  ) {}

  @Get('dm-exceptions')
  async list(
    @Request() req: { user: User },
    @Query() query: ListDmExceptionsQueryDto,
  ): Promise<ListDmExceptionsResponseDto> {
    return this.listExceptions.execute(req.user.id, query.limit, query.cursor);
  }

  @Put('dm-exceptions/:peerId')
  @HttpCode(204)
  async add(
    @Request() req: { user: User },
    @Param('peerId', new ParseUUIDPipe()) peerId: string,
  ): Promise<void> {
    await this.addException.execute(req.user.id, peerId);
  }

  @Delete('dm-exceptions/:peerId')
  @HttpCode(204)
  async remove(
    @Request() req: { user: User },
    @Param('peerId', new ParseUUIDPipe()) peerId: string,
  ): Promise<void> {
    await this.removeException.execute(req.user.id, peerId);
  }

  @Get('dm-exception-candidates')
  async listExceptionCandidates(
    @Request() req: { user: User },
    @Query() query: ListDmExceptionCandidatesQueryDto,
  ): Promise<ListDmExceptionCandidatesResponseDto> {
    return this.listCandidates.execute(
      req.user.id,
      query.limit,
      query.cursor,
      query.q,
    );
  }
}
