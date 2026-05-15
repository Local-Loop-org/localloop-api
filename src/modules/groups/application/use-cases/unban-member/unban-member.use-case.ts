import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MemberRole, MemberStatus } from '@localloop/shared-types';
import {
  GROUP_REPOSITORY,
  IGroupRepository,
} from '@domain/repositories/i-group.repository';

@Injectable()
export class UnbanMemberUseCase {
  constructor(
    @Inject(GROUP_REPOSITORY) private readonly groupRepo: IGroupRepository,
  ) {}

  async execute(
    callerId: string,
    groupId: string,
    targetUserId: string,
  ): Promise<void> {
    const caller = await this.groupRepo.findMember(groupId, callerId);
    const isPrivileged =
      caller &&
      caller.status === MemberStatus.ACTIVE &&
      (caller.role === MemberRole.OWNER ||
        caller.role === MemberRole.MODERATOR);

    if (!isPrivileged) {
      throw new ForbiddenException({
        error: 'FORBIDDEN',
        message: 'Only owners or moderators can unban members',
      });
    }

    const target = await this.groupRepo.findMember(groupId, targetUserId);
    if (!target) {
      throw new NotFoundException({
        error: 'MEMBER_NOT_FOUND',
        message: 'Member not found',
      });
    }

    if (target.status !== MemberStatus.BANNED) {
      throw new BadRequestException({
        error: 'TARGET_NOT_BANNED',
        message: 'Member is not banned',
      });
    }

    await this.groupRepo.unbanMemberAtomic(groupId, targetUserId);
  }
}
