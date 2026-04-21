import { Inject, Injectable } from '@nestjs/common';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '@/modules/auth/domain/repositories/i-user.repository';
import { coordinatesToGeohash } from '@localloop/geo-utils';
import { UpdateUserLocationDto } from './update-user-location.dto';

@Injectable()
export class UpdateUserLocationUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
  ) {}

  async execute(userId: string, dto: UpdateUserLocationDto): Promise<void> {
    const geohash = coordinatesToGeohash(dto.lat, dto.lng);
    await this.userRepo.updateGeohash(userId, geohash);
  }
}
