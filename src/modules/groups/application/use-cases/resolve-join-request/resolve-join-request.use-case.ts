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
import {
  JoinRequestAction,
  ResolveJoinRequestResponseDto,
} from './resolve-join-request.dto';

@Injectable()
export class ResolveJoinRequestUseCase {
  constructor(
    @Inject(GROUP_REPOSITORY) private readonly groupRepo: IGroupRepository,
  ) {}

  async execute(
    userId: string,
    groupId: string,
    requestId: string,
    action: JoinRequestAction,
  ): Promise<ResolveJoinRequestResponseDto> {
    const caller = await this.groupRepo.findMember(groupId, userId);
    const isPrivileged =
      caller &&
      caller.status === MemberStatus.ACTIVE &&
      (caller.role === MemberRole.OWNER ||
        caller.role === MemberRole.MODERATOR);

    if (!isPrivileged) {
      throw new ForbiddenException({
        error: 'FORBIDDEN',
        message: 'Only owners or moderators can resolve join requests',
      });
    }

    const request = await this.groupRepo.findJoinRequestById(
      groupId,
      requestId,
    );
    if (!request || request.status !== RequestStatus.PENDING) {
      throw new NotFoundException({
        error: 'REQUEST_NOT_FOUND',
        message: 'Pending join request not found',
      });
    }

    const resolvedAt = new Date();

    if (action === 'approve') {
      await this.groupRepo.approveJoinRequestAtomic({
        requestId,
        groupId,
        userId: request.userId,
        resolverId: userId,
        resolvedAt,
      });
      return { status: 'approved' };
    }

    await this.groupRepo.updateJoinRequestStatus(
      requestId,
      RequestStatus.REJECTED,
      resolvedAt,
      userId,
    );
    return { status: 'rejected' };
  }
}
