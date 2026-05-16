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
} from '@domain/repositories/i-group.repository';
import { ListBannedMembersResponseDto } from './list-banned-members.dto';

const DEFAULT_LIMIT = 50;

@Injectable()
export class ListBannedMembersUseCase {
  constructor(
    @Inject(GROUP_REPOSITORY) private readonly groupRepo: IGroupRepository,
  ) {}

  async execute(
    callerId: string,
    groupId: string,
    limit?: number,
    before?: string,
  ): Promise<ListBannedMembersResponseDto> {
    const group = await this.groupRepo.findById(groupId);
    if (!group) {
      throw new NotFoundException({
        error: 'GROUP_NOT_FOUND',
        message: 'Group not found',
      });
    }

    const caller = await this.groupRepo.findMember(groupId, callerId);
    const isPrivileged =
      caller &&
      caller.status === MemberStatus.ACTIVE &&
      (caller.role === MemberRole.OWNER ||
        caller.role === MemberRole.MODERATOR);

    if (!isPrivileged) {
      throw new ForbiddenException({
        error: 'FORBIDDEN',
        message: 'Only owners or moderators can list banned members',
      });
    }

    const { rows, nextCursor } = await this.groupRepo.listMembersPaginated(
      groupId,
      limit ?? DEFAULT_LIMIT,
      before,
      MemberStatus.BANNED,
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
