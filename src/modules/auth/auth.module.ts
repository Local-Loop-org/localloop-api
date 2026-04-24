import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { UserEntity } from './infra/repositories/user.entity';
import { USER_REPOSITORY } from './domain/repositories/i-user.repository';
import { UserTypeORMRepository } from './infra/repositories/user.typeorm.repository';

import { ExchangeGoogleTokenUseCase } from './application/use-cases/exchange-google-token/exchange-google-token.use-case';
import { ExchangeAppleTokenUseCase } from './application/use-cases/exchange-apple-token/exchange-apple-token.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token/refresh-token.use-case';

import { AuthController } from './presentation/auth.controller';
import { JwtStrategy } from './infra/strategies/jwt.strategy';
import { SupabaseService } from '@/shared/supabase/supabase.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET environment variable is required');
        }
        return {
          secret,
          signOptions: { expiresIn: '1h' },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    ExchangeGoogleTokenUseCase,
    ExchangeAppleTokenUseCase,
    RefreshTokenUseCase,
    JwtStrategy,
    SupabaseService,
    {
      provide: USER_REPOSITORY,
      useClass: UserTypeORMRepository,
    },
  ],
  exports: [USER_REPOSITORY, JwtModule],
})
export class AuthModule {}
