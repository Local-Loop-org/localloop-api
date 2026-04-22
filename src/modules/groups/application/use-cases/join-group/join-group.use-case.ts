import {
  ConflictException,
  ForbiddenException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GroupPrivacy,
  MemberRole,
  MemberStatus,
  RequestStatus,
} from '@localloop/shared-types';
import {
  GROUP_REPOSITORY,
  IGroupRepository,
} from '../../../domain/repositories/i-group.repository';
import { JoinGroupResponseDto } from './join-group.dto';

export interface JoinGroupResult {
  status: HttpStatus;
  body: JoinGroupResponseDto;
}

@Injectable()
export class JoinGroupUseCase {
  constructor(
    @Inject(GROUP_REPOSITORY) private readonly groupRepo: IGroupRepository,
  ) {}

  async execute(userId: string, groupId: string): Promise<JoinGroupResult> {
    const group = await this.groupRepo.findById(groupId);
    if (!group || !group.isActive) {
      throw new NotFoundException({
        error: 'GROUP_NOT_FOUND',
        message: 'Group not found',
      });
    }

    const existing = await this.groupRepo.findMember(groupId, userId);
    if (existing) {
      if (existing.status === MemberStatus.BANNED) {
        throw new ForbiddenException({
          error: 'BANNED',
          message: 'You are banned from this group',
        });
      }
      if (existing.status === MemberStatus.ACTIVE) {
        throw new ConflictException({
          error: 'ALREADY_MEMBER',
          message: 'You are already a member of this group',
        });
      }
      // PENDING — fall through to pending logic (no duplicate creation)
    }

    if (group.privacy === GroupPrivacy.OPEN) {
      await this.groupRepo.addMember(
        groupId,
        userId,
        MemberRole.MEMBER,
        MemberStatus.ACTIVE,
      );
      await this.groupRepo.incrementMemberCount(groupId);
      return {
        status: HttpStatus.OK,
        body: { status: 'joined', role: 'member' },
      };
    }

    // APPROVAL_REQUIRED
    const pending = await this.groupRepo.findPendingJoinRequest(
      groupId,
      userId,
    );
    if (!pending) {
      await this.groupRepo.createJoinRequest(
        groupId,
        userId,
        RequestStatus.PENDING,
      );
    }
    return {
      status: HttpStatus.ACCEPTED,
      body: { status: 'pending' },
    };
  }
}
