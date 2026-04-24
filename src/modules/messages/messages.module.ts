import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '@/modules/auth/auth.module';
import { GroupsModule } from '@/modules/groups/groups.module';

import { MESSAGE_REPOSITORY } from './domain/repositories/i-message.repository';
import { MessageOrmEntity } from './infra/repositories/message.entity';
import { MessageTypeORMRepository } from './infra/repositories/message.typeorm.repository';

import { SendMessageUseCase } from './application/use-cases/send-message/send-message.use-case';
import { GetMessageHistoryUseCase } from './application/use-cases/get-message-history/get-message-history.use-case';

import { MessagesController } from './presentation/messages.controller';
import { ChatGateway } from './presentation/chat.gateway';

@Module({
  imports: [
    AuthModule,
    GroupsModule,
    TypeOrmModule.forFeature([MessageOrmEntity]),
  ],
  controllers: [MessagesController],
  providers: [
    SendMessageUseCase,
    GetMessageHistoryUseCase,
    ChatGateway,
    {
      provide: MESSAGE_REPOSITORY,
      useClass: MessageTypeORMRepository,
    },
  ],
})
export class MessagesModule {}
