import { Module, Controller, Get } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { GroupsModule } from './modules/groups/groups.module';
import { UserEntity } from '@/modules/auth/infra/repositories/user.entity';
import { GroupOrmEntity } from '@/modules/groups/infra/repositories/group.entity';
import { GroupMemberOrmEntity } from '@/modules/groups/infra/repositories/group-member.entity';
import { GroupJoinRequestOrmEntity } from '@/modules/groups/infra/repositories/group-join-request.entity';
import { InitialSetup1710770000000 } from '@/infra/migrations/1710770000000-InitialSetup';
import { CreateGroups1713700000000 } from '@/infra/migrations/1713700000000-CreateGroups';

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
          entities: [
            UserEntity,
            GroupOrmEntity,
            GroupMemberOrmEntity,
            GroupJoinRequestOrmEntity,
          ],
          migrations: [InitialSetup1710770000000, CreateGroups1713700000000],
          migrationsRun: true,
          synchronize: false,
          logging: configService.get<string>('NODE_ENV') !== 'production',
          ssl: databaseUrl ? { rejectUnauthorized: false } : undefined,
        };
      },
    }),
    AuthModule,
    UserModule,
    GroupsModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
