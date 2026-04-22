import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';

import { CreateGroupUseCase } from '../application/use-cases/create-group/create-group.use-case';
import { DiscoverNearbyGroupsUseCase } from '../application/use-cases/discover-nearby-groups/discover-nearby-groups.use-case';
import { GetGroupDetailUseCase } from '../application/use-cases/get-group-detail/get-group-detail.use-case';
import { JoinGroupUseCase } from '../application/use-cases/join-group/join-group.use-case';
import { ListJoinRequestsUseCase } from '../application/use-cases/list-join-requests/list-join-requests.use-case';

import {
  CreateGroupDto,
  CreateGroupResponseDto,
} from '../application/use-cases/create-group/create-group.dto';
import {
  DiscoverNearbyGroupsQueryDto,
  DiscoverNearbyGroupsResponseDto,
} from '../application/use-cases/discover-nearby-groups/discover-nearby-groups.dto';
import { GroupDetailDto } from '../application/use-cases/get-group-detail/get-group-detail.dto';
import { ListJoinRequestsResponseDto } from '../application/use-cases/list-join-requests/list-join-requests.dto';
import { User } from '@/modules/auth/domain/entities/user.entity';

@Controller('groups')
@UseGuards(AuthGuard('jwt'))
export class GroupsController {
  constructor(
    private readonly createGroup: CreateGroupUseCase,
    private readonly discoverNearby: DiscoverNearbyGroupsUseCase,
    private readonly getGroupDetail: GetGroupDetailUseCase,
    private readonly joinGroup: JoinGroupUseCase,
    private readonly listJoinRequests: ListJoinRequestsUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Request() req: { user: User },
    @Body() dto: CreateGroupDto,
  ): Promise<CreateGroupResponseDto> {
    return this.createGroup.execute(req.user.id, dto);
  }

  @Get('nearby')
  async nearby(
    @Query() query: DiscoverNearbyGroupsQueryDto,
  ): Promise<DiscoverNearbyGroupsResponseDto> {
    return this.discoverNearby.execute(query);
  }

  @Get(':id')
  async detail(
    @Request() req: { user: User },
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<GroupDetailDto> {
    return this.getGroupDetail.execute(req.user.id, id);
  }

  @Post(':id/join')
  async join(
    @Request() req: { user: User },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.joinGroup.execute(req.user.id, id);
    res.status(result.status);
    return result.body;
  }

  @Get(':id/requests')
  async requests(
    @Request() req: { user: User },
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ListJoinRequestsResponseDto> {
    return this.listJoinRequests.execute(req.user.id, id);
  }
}
