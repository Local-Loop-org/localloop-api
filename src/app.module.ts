import { Module, Controller, Get } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { UserEntity } from '@/modules/auth/infra/repositories/user.entity';
import { InitialSetup1710770000000 } from '@/infra/migrations/1710770000000-InitialSetup';

@Controller()
class HealthController {
  @Get('health')
  check() {
    return { status: 'ok' };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get<string>('DATABASE_URL');
        const baseConfig = databaseUrl
          ? { url: databaseUrl }
          : {
              host: configService.get<string>('DB_HOST', 'localhost'),
              port: configService.get<number>('DB_PORT', 5432),
              username: configService.get<string>('DB_USERNAME', 'postgres'),
              password: configService.get<string>('DB_PASSWORD', 'postgres'),
              database: configService.get<string>('DB_NAME', 'localloop'),
            };
        return {
          type: 'postgres' as const,
          ...baseConfig,
          entities: [UserEntity],
          migrations: [InitialSetup1710770000000],
          migrationsRun: true,
          synchronize: false,
          logging: configService.get<string>('NODE_ENV') !== 'production',
          ssl: databaseUrl ? { rejectUnauthorized: false } : undefined,
        };
      },
    }),
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
