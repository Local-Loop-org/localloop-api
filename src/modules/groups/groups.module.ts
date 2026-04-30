import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@/modules/auth/auth.module';

import { GroupOrmEntity } from './infra/repositories/group.entity';
import { GroupMemberOrmEntity } from './infra/repositories/group-member.entity';
import { GroupJoinRequestOrmEntity } from './infra/repositories/group-join-request.entity';
import { GroupTypeORMRepository } from './infra/repositories/group.typeorm.repository';
import { GROUP_REPOSITORY } from './domain/repositories/i-group.repository';

import { CreateGroupUseCase } from './application/use-cases/create-group/create-group.use-case';
import { DiscoverNearbyGroupsUseCase } from './application/use-cases/discover-nearby-groups/discover-nearby-groups.use-case';
import { GetGroupDetailUseCase } from './application/use-cases/get-group-detail/get-group-detail.use-case';
import { JoinGroupUseCase } from './application/use-cases/join-group/join-group.use-case';
import { ListJoinRequestsUseCase } from './application/use-cases/list-join-requests/list-join-requests.use-case';
import { LeaveGroupUseCase } from './application/use-cases/leave-group/leave-group.use-case';
import { ResolveJoinRequestUseCase } from './application/use-cases/resolve-join-request/resolve-join-request.use-case';
import { BanMemberUseCase } from './application/use-cases/ban-member/ban-member.use-case';
import { ListGroupMembersUseCase } from './application/use-cases/list-group-members/list-group-members.use-case';
import { ListMyGroupsUseCase } from './application/use-cases/list-my-groups/list-my-groups.use-case';

import { GroupsController } from './presentation/groups.controller';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      GroupOrmEntity,
      GroupMemberOrmEntity,
      GroupJoinRequestOrmEntity,
    ]),
  ],
  controllers: [GroupsController],
  providers: [
    CreateGroupUseCase,
    DiscoverNearbyGroupsUseCase,
    GetGroupDetailUseCase,
    JoinGroupUseCase,
    ListJoinRequestsUseCase,
    LeaveGroupUseCase,
    ResolveJoinRequestUseCase,
    BanMemberUseCase,
    ListGroupMembersUseCase,
    ListMyGroupsUseCase,
    {
      provide: GROUP_REPOSITORY,
      useClass: GroupTypeORMRepository,
    },
  ],
  exports: [GROUP_REPOSITORY],
})
export class GroupsModule {}
