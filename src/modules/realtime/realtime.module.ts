import { Module } from '@nestjs/common';

import { AuthModule } from '@/modules/auth/auth.module';
import { DirectMessagesModule } from '@/modules/direct-messages/direct-messages.module';
import { GroupsModule } from '@/modules/groups/groups.module';
import { MessagesModule } from '@/modules/messages/messages.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { RealtimeEventsModule } from '@/modules/realtime-events/realtime-events.module';
import { DirectMessageRealtimeEventHandler } from './application/direct-message-realtime-event.handler';
import { ChatGateway } from './presentation/chat.gateway';

@Module({
  imports: [
    AuthModule,
    GroupsModule,
    NotificationsModule,
    MessagesModule,
    DirectMessagesModule,
    RealtimeEventsModule,
  ],
  providers: [ChatGateway, DirectMessageRealtimeEventHandler],
})
export class RealtimeModule {}
