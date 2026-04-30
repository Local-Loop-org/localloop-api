import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { LeaveGroupUseCase } from '../application/use-cases/leave-group/leave-group.use-case';
import { ResolveJoinRequestUseCase } from '../application/use-cases/resolve-join-request/resolve-join-request.use-case';
import { BanMemberUseCase } from '../application/use-cases/ban-member/ban-member.use-case';
import { ListGroupMembersUseCase } from '../application/use-cases/list-group-members/list-group-members.use-case';
import { ListMyGroupsUseCase } from '../application/use-cases/list-my-groups/list-my-groups.use-case';

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
import {
  ResolveJoinRequestDto,
  ResolveJoinRequestResponseDto,
} from '../application/use-cases/resolve-join-request/resolve-join-request.dto';
import {
  ListGroupMembersQueryDto,
  ListGroupMembersResponseDto,
} from '../application/use-cases/list-group-members/list-group-members.dto';
import {
  ListMyGroupsQueryDto,
  ListMyGroupsResponseDto,
} from '../application/use-cases/list-my-groups/list-my-groups.dto';
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
    private readonly leaveGroup: LeaveGroupUseCase,
    private readonly resolveJoinRequest: ResolveJoinRequestUseCase,
    private readonly banMember: BanMemberUseCase,
    private readonly listMembers: ListGroupMembersUseCase,
    private readonly listMyGroups: ListMyGroupsUseCase,
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

  // Must be registered before @Get(':id') so the literal 'me' is not parsed as a UUID.
  @Get('me')
  async myGroups(
    @Request() req: { user: User },
    @Query() query: ListMyGroupsQueryDto,
  ): Promise<ListMyGroupsResponseDto> {
    return this.listMyGroups.execute(req.user.id, query.limit, query.cursor);
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

  @Patch(':id/requests/:requestId')
  async resolveRequest(
    @Request() req: { user: User },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
    @Body() dto: ResolveJoinRequestDto,
  ): Promise<ResolveJoinRequestResponseDto> {
    return this.resolveJoinRequest.execute(
      req.user.id,
      id,
      requestId,
      dto.action,
    );
  }

  @Delete(':id/members/me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async leave(
    @Request() req: { user: User },
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.leaveGroup.execute(req.user.id, id);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async ban(
    @Request() req: { user: User },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<void> {
    await this.banMember.execute(req.user.id, id, userId);
  }

  @Get(':id/members')
  async members(
    @Request() req: { user: User },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: ListGroupMembersQueryDto,
  ): Promise<ListGroupMembersResponseDto> {
    return this.listMembers.execute(req.user.id, id, query.limit, query.before);
  }
}
