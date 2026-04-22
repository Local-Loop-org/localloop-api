import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MemberRole,
  MemberStatus,
  RequestStatus,
} from '@localloop/shared-types';
import {
  GROUP_REPOSITORY,
  IGroupRepository,
} from '../../../domain/repositories/i-group.repository';
import { ListJoinRequestsResponseDto } from './list-join-requests.dto';

@Injectable()
export class ListJoinRequestsUseCase {
  constructor(
    @Inject(GROUP_REPOSITORY) private readonly groupRepo: IGroupRepository,
  ) {}

  async execute(
    userId: string,
    groupId: string,
  ): Promise<ListJoinRequestsResponseDto> {
    const group = await this.groupRepo.findById(groupId);
    if (!group) {
      throw new NotFoundException({
        error: 'GROUP_NOT_FOUND',
        message: 'Group not found',
      });
    }

    const caller = await this.groupRepo.findMember(groupId, userId);
    const isPrivileged =
      caller &&
      caller.status === MemberStatus.ACTIVE &&
      (caller.role === MemberRole.OWNER ||
        caller.role === MemberRole.MODERATOR);

    if (!isPrivileged) {
      throw new ForbiddenException({
        error: 'FORBIDDEN',
        message: 'Only owners or moderators can view join requests',
      });
    }

    const rows = await this.groupRepo.listJoinRequestsByStatus(
      groupId,
      RequestStatus.PENDING,
    );

    return {
      data: rows.map(({ request, requesterDisplayName }) => ({
        id: request.id,
        userId: request.userId,
        displayName: requesterDisplayName,
        createdAt: request.createdAt.toISOString(),
      })),
    };
  }
}
