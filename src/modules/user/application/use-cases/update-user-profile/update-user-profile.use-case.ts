import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '@/modules/auth/domain/repositories/i-user.repository';
import { UpdateUserProfileDto } from './update-user-profile.dto';
import { UserProfileDto } from '../get-user-profile/get-user-profile.dto';

@Injectable()
export class UpdateUserProfileUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
  ) {}

  async execute(
    userId: string,
    dto: UpdateUserProfileDto,
  ): Promise<UserProfileDto> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.displayName !== undefined) {
      user.displayName = dto.displayName;
    }
    if (dto.dmPermission !== undefined) {
      user.dmPermission = dto.dmPermission;
    }

    const updated = await this.userRepo.save(user);
    return UserProfileDto.fromEntity(updated);
  }
}
