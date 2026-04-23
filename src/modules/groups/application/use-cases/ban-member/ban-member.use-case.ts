import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MemberRole, MemberStatus } from '@localloop/shared-types';
import {
  GROUP_REPOSITORY,
  IGroupRepository,
} from '../../../domain/repositories/i-group.repository';

@Injectable()
export class BanMemberUseCase {
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
        message: 'Only owners or moderators can ban members',
      });
    }

    const target = await this.groupRepo.findMember(groupId, targetUserId);
    if (!target) {
      throw new NotFoundException({
        error: 'MEMBER_NOT_FOUND',
        message: 'Member not found',
      });
    }

    if (target.role === MemberRole.OWNER) {
      throw new ForbiddenException({
        error: 'CANNOT_BAN_OWNER',
        message: 'The group owner cannot be banned',
      });
    }

    if (
      caller.role === MemberRole.MODERATOR &&
      target.role === MemberRole.MODERATOR
    ) {
      throw new ForbiddenException({
        error: 'MODERATOR_CANNOT_BAN_MODERATOR',
        message: 'Moderators cannot ban other moderators',
      });
    }

    await this.groupRepo.banMemberAtomic(groupId, targetUserId);
  }
}
