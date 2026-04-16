import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';

import { AuthController } from '../../src/modules/auth/presentation/auth.controller';
import { ExchangeGoogleTokenUseCase } from '../../src/modules/auth/application/use-cases/exchange-google-token/exchange-google-token.use-case';
import { ExchangeAppleTokenUseCase } from '../../src/modules/auth/application/use-cases/exchange-apple-token/exchange-apple-token.use-case';
import { RefreshTokenUseCase } from '../../src/modules/auth/application/use-cases/refresh-token/refresh-token.use-case';
import { USER_REPOSITORY } from '../../src/modules/auth/domain/repositories/i-user.repository';
import { SupabaseService } from '../../src/shared/supabase/supabase.service';

import { InMemoryUserRepository } from './in-memory-user.repository';

const TEST_JWT_SECRET = 'test-secret-e2e';

@Module({
  imports: [
    JwtModule.register({
      secret: TEST_JWT_SECRET,
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    ExchangeGoogleTokenUseCase,
    ExchangeAppleTokenUseCase,
    RefreshTokenUseCase,
    { provide: USER_REPOSITORY, useClass: InMemoryUserRepository },
    { provide: SupabaseService, useValue: { verifyGoogleToken: jest.fn(), verifyAppleToken: jest.fn() } },
  ],
})
class AuthTestModule {}

export interface AuthTestApp {
  app: INestApplication;
  userRepo: InMemoryUserRepository;
  supabase: jest.Mocked<SupabaseService>;
  jwtService: JwtService;
  jwtSecret: string;
}

export const setupAuthTestApp = async (): Promise<AuthTestApp> => {
  const moduleRef = await Test.createTestingModule({
    imports: [AuthTestModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  return {
    app,
    userRepo: moduleRef.get<InMemoryUserRepository>(USER_REPOSITORY),
    supabase: moduleRef.get(SupabaseService) as jest.Mocked<SupabaseService>,
    jwtService: moduleRef.get(JwtService),
    jwtSecret: TEST_JWT_SECRET,
  };
};
