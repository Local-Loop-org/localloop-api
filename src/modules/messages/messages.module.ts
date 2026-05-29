import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '@/modules/auth/auth.module';
import { GroupsModule } from '@/modules/groups/groups.module';
import { RealtimeEventsModule } from '@/modules/realtime-events/realtime-events.module';

import { MESSAGE_REPOSITORY } from './domain/repositories/i-message.repository';
import { MessageOrmEntity } from './infra/repositories/message.entity';
import { MessageTypeORMRepository } from './infra/repositories/message.typeorm.repository';

import { SendMessageUseCase } from './application/use-cases/send-message/send-message.use-case';
import { GetMessageHistoryUseCase } from './application/use-cases/get-message-history/get-message-history.use-case';
import { DeleteMessageUseCase } from './application/use-cases/delete-message/delete-message.use-case';
import { EditMessageUseCase } from './application/use-cases/edit-message/edit-message.use-case';

import { MessagesController } from './presentation/messages.controller';
import { MessageItemController } from './presentation/message-item.controller';

@Module({
  imports: [
    AuthModule,
    GroupsModule,
    RealtimeEventsModule,
    TypeOrmModule.forFeature([MessageOrmEntity]),
  ],
  controllers: [MessagesController, MessageItemController],
  providers: [
    SendMessageUseCase,
    GetMessageHistoryUseCase,
    DeleteMessageUseCase,
    EditMessageUseCase,
    {
      provide: MESSAGE_REPOSITORY,
      useClass: MessageTypeORMRepository,
    },
  ],
  exports: [SendMessageUseCase],
})
export class MessagesModule {}
