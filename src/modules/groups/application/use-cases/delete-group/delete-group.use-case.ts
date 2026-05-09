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
} from '@domain/repositories/i-group.repository';

@Injectable()
export class DeleteGroupUseCase {
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
    if (!member || member.role !== MemberRole.OWNER) {
      throw new ForbiddenException({
        error: 'NOT_THE_OWNER',
        message: 'Only the group owner can delete the group',
      });
    }

    await this.groupRepo.deleteGroupAtomic(groupId);
  }
}
