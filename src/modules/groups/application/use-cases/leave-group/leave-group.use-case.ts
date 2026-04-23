import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MemberRole } from '@localloop/shared-types';
import {
  GROUP_REPOSITORY,
  IGroupRepository,
} from '../../../domain/repositories/i-group.repository';

@Injectable()
export class LeaveGroupUseCase {
  constructor(
    @Inject(GROUP_REPOSITORY) private readonly groupRepo: IGroupRepository,
  ) {}

  async execute(userId: string, groupId: string): Promise<void> {
    const group = await this.groupRepo.findById(groupId);
    if (!group) {
      throw new NotFoundException({
        error: 'GROUP_NOT_FOUND',
        message: 'Group not found',
      });
    }

    const member = await this.groupRepo.findMember(groupId, userId);
    if (!member) {
      throw new NotFoundException({
        error: 'NOT_A_MEMBER',
        message: 'You are not a member of this group',
      });
    }

    if (member.role === MemberRole.OWNER) {
      throw new ForbiddenException({
        error: 'OWNER_CANNOT_LEAVE',
        message: 'Owner must transfer ownership before leaving',
      });
    }

    await this.groupRepo.leaveGroupAtomic(groupId, userId);
  }
}
