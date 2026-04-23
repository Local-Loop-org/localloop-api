import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MemberStatus } from '@localloop/shared-types';
import {
  GROUP_REPOSITORY,
  IGroupRepository,
} from '../../../domain/repositories/i-group.repository';
import { ListGroupMembersResponseDto } from './list-group-members.dto';

const DEFAULT_LIMIT = 50;

@Injectable()
export class ListGroupMembersUseCase {
  constructor(
    @Inject(GROUP_REPOSITORY) private readonly groupRepo: IGroupRepository,
  ) {}

  async execute(
    userId: string,
    groupId: string,
    limit?: number,
    before?: string,
  ): Promise<ListGroupMembersResponseDto> {
    const group = await this.groupRepo.findById(groupId);
    if (!group) {
      throw new NotFoundException({
        error: 'GROUP_NOT_FOUND',
        message: 'Group not found',
      });
    }

    const caller = await this.groupRepo.findMember(groupId, userId);
    if (!caller || caller.status !== MemberStatus.ACTIVE) {
      throw new ForbiddenException({
        error: 'FORBIDDEN',
        message: 'Only active members can list group members',
      });
    }

    const { rows, nextCursor } = await this.groupRepo.listMembersPaginated(
      groupId,
      limit ?? DEFAULT_LIMIT,
      before,
    );

    return {
      data: rows.map((row) => ({
        userId: row.userId,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
        role: row.role,
      })),
      next_cursor: nextCursor,
    };
  }
}
