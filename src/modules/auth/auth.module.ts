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
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'fallback-secret',
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    ExchangeGoogleTokenUseCase,
    ExchangeAppleTokenUseCase,
    JwtStrategy,
    SupabaseService,
    {
      provide: USER_REPOSITORY,
      useClass: UserTypeORMRepository,
    },
  ],
  exports: [USER_REPOSITORY],
})
export class AuthModule {}
