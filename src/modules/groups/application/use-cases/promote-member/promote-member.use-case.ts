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
export class PromoteMemberUseCase {
  constructor(
    @Inject(GROUP_REPOSITORY) private readonly groupRepo: IGroupRepository,
  ) {}

  async execute(
    callerId: string,
    groupId: string,
    targetUserId: string,
  ): Promise<void> {
    const caller = await this.groupRepo.findMember(groupId, callerId);
    const isOwner =
      caller &&
      caller.status === MemberStatus.ACTIVE &&
      caller.role === MemberRole.OWNER;

    if (!isOwner) {
      throw new ForbiddenException({
        error: 'FORBIDDEN',
        message: 'Only the group owner can promote members',
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
        error: 'CANNOT_CHANGE_OWNER_ROLE',
        message: 'The group owner role cannot be changed',
      });
    }

    if (target.status !== MemberStatus.ACTIVE) {
      throw new BadRequestException({
        error: 'TARGET_NOT_ACTIVE',
        message: 'Only active members can be promoted',
      });
    }

    if (target.role === MemberRole.MODERATOR) {
      throw new BadRequestException({
        error: 'ALREADY_MODERATOR',
        message: 'Member is already a moderator',
      });
    }

    await this.groupRepo.updateMemberRole(
      groupId,
      targetUserId,
      MemberRole.MODERATOR,
    );
  }
}
