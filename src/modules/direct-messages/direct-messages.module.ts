import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '@/modules/auth/auth.module';
import { GroupsModule } from '@/modules/groups/groups.module';
import { RealtimeEventsModule } from '@/modules/realtime-events/realtime-events.module';

import { DIRECT_MESSAGE_REPOSITORY } from './domain/repositories/i-direct-message.repository';
import { DirectMessageOrmEntity } from './infra/repositories/direct-message.entity';
import { DirectMessageTypeORMRepository } from './infra/repositories/direct-message.typeorm.repository';

import { SendDirectMessageUseCase } from './application/use-cases/send-direct-message/send-direct-message.use-case';
import { GetDirectMessageHistoryUseCase } from './application/use-cases/get-direct-message-history/get-direct-message-history.use-case';
import { ListDmConversationsUseCase } from './application/use-cases/list-dm-conversations/list-dm-conversations.use-case';
import { ListDmRequestsUseCase } from './application/use-cases/list-dm-requests/list-dm-requests.use-case';
import { AcceptDmRequestUseCase } from './application/use-cases/accept-dm-request/accept-dm-request.use-case';
import { DeclineDmRequestUseCase } from './application/use-cases/decline-dm-request/decline-dm-request.use-case';
import { ListDmExceptionsUseCase } from './application/use-cases/list-dm-exceptions/list-dm-exceptions.use-case';
import { ListDmExceptionCandidatesUseCase } from './application/use-cases/list-dm-exception-candidates/list-dm-exception-candidates.use-case';
import { AddDmExceptionUseCase } from './application/use-cases/add-dm-exception/add-dm-exception.use-case';
import { RemoveDmExceptionUseCase } from './application/use-cases/remove-dm-exception/remove-dm-exception.use-case';
import { MarkDmReadUseCase } from './application/use-cases/mark-dm-read/mark-dm-read.use-case';
import { ArchiveDmConversationUseCase } from './application/use-cases/archive-dm-conversation/archive-dm-conversation.use-case';
import { UnarchiveDmConversationUseCase } from './application/use-cases/unarchive-dm-conversation/unarchive-dm-conversation.use-case';
import { DeleteDirectMessageUseCase } from './application/use-cases/delete-direct-message/delete-direct-message.use-case';

import { DirectMessagesController } from './presentation/direct-messages.controller';
import { DmExceptionsController } from './presentation/dm-exceptions.controller';

@Module({
  imports: [
    AuthModule,
    GroupsModule,
    RealtimeEventsModule,
    TypeOrmModule.forFeature([DirectMessageOrmEntity]),
  ],
  controllers: [DirectMessagesController, DmExceptionsController],
  providers: [
    SendDirectMessageUseCase,
    GetDirectMessageHistoryUseCase,
    ListDmConversationsUseCase,
    ListDmRequestsUseCase,
    AcceptDmRequestUseCase,
    DeclineDmRequestUseCase,
    ListDmExceptionsUseCase,
    ListDmExceptionCandidatesUseCase,
    AddDmExceptionUseCase,
    RemoveDmExceptionUseCase,
    MarkDmReadUseCase,
    ArchiveDmConversationUseCase,
    UnarchiveDmConversationUseCase,
    DeleteDirectMessageUseCase,
    {
      provide: DIRECT_MESSAGE_REPOSITORY,
      useClass: DirectMessageTypeORMRepository,
    },
  ],
  exports: [
    SendDirectMessageUseCase,
    GetDirectMessageHistoryUseCase,
    ListDmConversationsUseCase,
    ListDmRequestsUseCase,
    AcceptDmRequestUseCase,
    DeclineDmRequestUseCase,
    ListDmExceptionsUseCase,
    ListDmExceptionCandidatesUseCase,
    AddDmExceptionUseCase,
    RemoveDmExceptionUseCase,
    MarkDmReadUseCase,
    ArchiveDmConversationUseCase,
    UnarchiveDmConversationUseCase,
    DIRECT_MESSAGE_REPOSITORY,
  ],
})
export class DirectMessagesModule {}
