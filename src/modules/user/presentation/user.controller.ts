import {
  Controller,
  Get,
  Patch,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GetUserProfileUseCase } from '../application/use-cases/get-user-profile/get-user-profile.use-case';
import { UpdateUserProfileUseCase } from '../application/use-cases/update-user-profile/update-user-profile.use-case';
import { UpdateUserLocationUseCase } from '../application/use-cases/update-user-location/update-user-location.use-case';
import { UpdateUserProfileDto } from '../application/use-cases/update-user-profile/update-user-profile.dto';
import { UpdateUserLocationDto } from '../application/use-cases/update-user-location/update-user-location.dto';
import { UserProfileDto } from '../application/use-cases/get-user-profile/get-user-profile.dto';
import { User } from '@/modules/auth/domain/entities/user.entity';

@Controller('users')
@UseGuards(AuthGuard('jwt'))
export class UserController {
  constructor(
    private readonly getUserProfile: GetUserProfileUseCase,
    private readonly updateUserProfile: UpdateUserProfileUseCase,
    private readonly updateUserLocation: UpdateUserLocationUseCase,
  ) {}

  @Get('me')
  async getMe(@Request() req: { user: User }): Promise<UserProfileDto> {
    return this.getUserProfile.execute(req.user.id);
  }

  @Patch('me')
  async updateMe(
    @Request() req: { user: User },
    @Body() dto: UpdateUserProfileDto,
  ): Promise<UserProfileDto> {
    return this.updateUserProfile.execute(req.user.id, dto);
  }

  @Patch('me/location')
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateLocation(
    @Request() req: { user: User },
    @Body() dto: UpdateUserLocationDto,
  ): Promise<void> {
    await this.updateUserLocation.execute(req.user.id, dto);
  }
}
