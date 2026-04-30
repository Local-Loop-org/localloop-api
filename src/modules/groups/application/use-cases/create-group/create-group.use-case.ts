import { Inject, Injectable } from '@nestjs/common';
import { coordinatesToGeohash } from '@localloop/geo-utils';
import {
  GROUP_REPOSITORY,
  IGroupRepository,
} from '../../../domain/repositories/i-group.repository';
import { CreateGroupDto, CreateGroupResponseDto } from './create-group.dto';

@Injectable()
export class CreateGroupUseCase {
  constructor(
    @Inject(GROUP_REPOSITORY) private readonly groupRepo: IGroupRepository,
  ) {}

  async execute(
    userId: string,
    dto: CreateGroupDto,
  ): Promise<CreateGroupResponseDto> {
    const anchorGeohash = coordinatesToGeohash(dto.lat, dto.lng);
    const group = await this.groupRepo.createGroupWithOwner({
      name: dto.name,
      description: dto.description ?? null,
      anchorType: dto.anchorType,
      anchorGeohash,
      anchorLat: dto.lat,
      anchorLng: dto.lng,
      anchorLabel: dto.anchorLabel,
      privacy: dto.privacy,
      ownerId: userId,
      memberCount: 1,
    });

    return {
      id: group.id,
      name: group.name,
      anchorType: group.anchorType,
      anchorLabel: group.anchorLabel,
      privacy: group.privacy,
      memberCount: group.memberCount,
      myRole: 'owner',
    };
  }
}
