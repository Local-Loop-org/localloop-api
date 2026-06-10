import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { coordinatesToGeohash } from '@localloop/geo-utils';
import { MemberRole, MemberStatus } from '@localloop/shared-types';
import {
  GROUP_REPOSITORY,
  IGroupRepository,
} from '@domain/repositories/i-group.repository';
import { GroupDetailDto } from '../get-group-detail/get-group-detail.dto';
import { UpdateGroupDto } from './update-group.dto';

@Injectable()
export class UpdateGroupUseCase {
  constructor(
    @Inject(GROUP_REPOSITORY) private readonly groupRepo: IGroupRepository,
  ) {}

  async execute(
    callerId: string,
    groupId: string,
    dto: UpdateGroupDto,
  ): Promise<GroupDetailDto> {
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
        error: 'NOT_PRIVILEGED',
        message: 'Only owners or moderators can update group settings',
      });
    }

    const anchorUpdate =
      dto.lat !== undefined && dto.lng !== undefined
        ? {
            anchorLat: dto.lat,
            anchorLng: dto.lng,
            anchorGeohash: coordinatesToGeohash(dto.lat, dto.lng),
          }
        : {};
    const anchorLabel =
      dto.anchorLabel === undefined ? undefined : dto.anchorLabel?.trim() || null;

    const updated = await this.groupRepo.updateGroup(groupId, {
      name: dto.name,
      description: dto.description,
      anchorLabel,
      privacy: dto.privacy,
      radiusKm: dto.radiusKm,
      ...anchorUpdate,
    });

    return {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      anchorType: updated.anchorType,
      anchorLat: updated.anchorLat,
      anchorLng: updated.anchorLng,
      anchorLabel: updated.anchorLabel,
      privacy: updated.privacy,
      radiusKm: updated.radiusKm,
      memberCount: updated.memberCount,
      myRole: caller.role,
      createdAt: updated.createdAt.toISOString(),
    };
  }
}
