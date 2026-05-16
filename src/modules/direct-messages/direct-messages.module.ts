import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '@/modules/auth/auth.module';
import { GroupsModule } from '@/modules/groups/groups.module';

import { DIRECT_MESSAGE_REPOSITORY } from './domain/repositories/i-direct-message.repository';
import { DirectMessageOrmEntity } from './infra/repositories/direct-message.entity';
import { DirectMessageTypeORMRepository } from './infra/repositories/direct-message.typeorm.repository';

import { SendDirectMessageUseCase } from './application/use-cases/send-direct-message/send-direct-message.use-case';
import { GetDirectMessageHistoryUseCase } from './application/use-cases/get-direct-message-history/get-direct-message-history.use-case';

import { DirectMessagesController } from './presentation/direct-messages.controller';

@Module({
  imports: [
    AuthModule,
    GroupsModule,
    TypeOrmModule.forFeature([DirectMessageOrmEntity]),
  ],
  controllers: [DirectMessagesController],
  providers: [
    SendDirectMessageUseCase,
    GetDirectMessageHistoryUseCase,
    {
      provide: DIRECT_MESSAGE_REPOSITORY,
      useClass: DirectMessageTypeORMRepository,
    },
  ],
  exports: [SendDirectMessageUseCase, GetDirectMessageHistoryUseCase],
})
export class DirectMessagesModule {}
