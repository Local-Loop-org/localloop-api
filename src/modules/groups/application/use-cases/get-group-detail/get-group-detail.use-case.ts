import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MemberStatus } from '@localloop/shared-types';
import {
  GROUP_REPOSITORY,
  IGroupRepository,
} from '../../../domain/repositories/i-group.repository';
import { GroupDetailDto } from './get-group-detail.dto';

@Injectable()
export class GetGroupDetailUseCase {
  constructor(
    @Inject(GROUP_REPOSITORY) private readonly groupRepo: IGroupRepository,
  ) {}

  async execute(userId: string, groupId: string): Promise<GroupDetailDto> {
    const group = await this.groupRepo.findById(groupId);
    if (!group) {
      throw new NotFoundException({
        error: 'GROUP_NOT_FOUND',
        message: 'Group not found',
      });
    }

    const member = await this.groupRepo.findMember(groupId, userId);
    const myRole =
      member && member.status === MemberStatus.ACTIVE ? member.role : null;

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      anchorType: group.anchorType,
      anchorLabel: group.anchorLabel,
      privacy: group.privacy,
      memberCount: group.memberCount,
      myRole,
    };
  }
}
