import { Module } from '@nestjs/common';

import { AuthModule } from '@/modules/auth/auth.module';
import { DirectMessagesModule } from '@/modules/direct-messages/direct-messages.module';
import { GroupsModule } from '@/modules/groups/groups.module';
import { MessagesModule } from '@/modules/messages/messages.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { RealtimeEventsModule } from '@/modules/realtime-events/realtime-events.module';
import { DirectMessageRealtimeEventHandler } from './presentation/direct-message-realtime-event.handler';
import { DmInboxRealtimeService } from './presentation/services/dm-inbox-realtime.service';
import { DmMessageRealtimeService } from './presentation/services/dm-message-realtime.service';
import { DmPresenceRealtimeService } from './presentation/services/dm-presence-realtime.service';
import { DmTypingRealtimeService } from './presentation/services/dm-typing-realtime.service';
import { GroupMessageRealtimeService } from './presentation/services/group-message-realtime.service';
import { GroupPresenceRealtimeService } from './presentation/services/group-presence-realtime.service';
import { GroupSummaryRealtimeService } from './presentation/services/group-summary-realtime.service';
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
  providers: [
    ChatGateway,
    DirectMessageRealtimeEventHandler,
    GroupPresenceRealtimeService,
    GroupSummaryRealtimeService,
    GroupMessageRealtimeService,
    DmPresenceRealtimeService,
    DmInboxRealtimeService,
    DmMessageRealtimeService,
    DmTypingRealtimeService,
  ],
})
export class RealtimeModule {}
