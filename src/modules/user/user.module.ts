import { Module } from '@nestjs/common';
import { AuthModule } from '@/modules/auth/auth.module';
import { GetUserProfileUseCase } from './application/use-cases/get-user-profile/get-user-profile.use-case';
import { UpdateUserProfileUseCase } from './application/use-cases/update-user-profile/update-user-profile.use-case';
import { UpdateUserLocationUseCase } from './application/use-cases/update-user-location/update-user-location.use-case';
import { UserController } from './presentation/user.controller';

@Module({
  imports: [AuthModule],
  controllers: [UserController],
  providers: [
    GetUserProfileUseCase,
    UpdateUserProfileUseCase,
    UpdateUserLocationUseCase,
  ],
})
export class UserModule {}
