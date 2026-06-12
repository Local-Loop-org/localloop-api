import { InitialSetup1710770000000 } from '@/infra/migrations/1710770000000-InitialSetup';
import { CreateGroups1713700000000 } from '@/infra/migrations/1713700000000-CreateGroups';
import { CreateMessages1714000000000 } from '@/infra/migrations/1714000000000-CreateMessages';
import { AddGroupAnchorCoordinates1714500000000 } from '@/infra/migrations/1714500000000-AddGroupAnchorCoordinates';
import { AddGroupRadius1715000000000 } from '@/infra/migrations/1715000000000-AddGroupRadius';
import { AddPushNotifications1716000000000 } from '@/infra/migrations/1716000000000-AddPushNotifications';
import { AddGroupMemberLastReadAt1716100000000 } from '@/infra/migrations/1716100000000-AddGroupMemberLastReadAt';
import { CreateDirectMessages1717000000000 } from '@/infra/migrations/1717000000000-CreateDirectMessages';
import { AddDmInboxSupport1717100000000 } from '@/infra/migrations/1717100000000-AddDmInboxSupport';
import { AddChatNotificationDigests1717200000000 } from '@/infra/migrations/1717200000000-AddChatNotificationDigests';
import { AddMessageReplyAndEditedColumns1717300000000 } from '@/infra/migrations/1717300000000-AddMessageReplyAndEditedColumns';
import { MakeGroupAnchorLabelNullable1717400000000 } from '@/infra/migrations/1717400000000-MakeGroupAnchorLabelNullable';
import { AddGroupSendPermissions1717500000000 } from '@/infra/migrations/1717500000000-AddGroupSendPermissions';

export const typeormMigrations = [
  InitialSetup1710770000000,
  CreateGroups1713700000000,
  CreateMessages1714000000000,
  AddGroupAnchorCoordinates1714500000000,
  AddGroupRadius1715000000000,
  AddPushNotifications1716000000000,
  AddGroupMemberLastReadAt1716100000000,
  CreateDirectMessages1717000000000,
  AddDmInboxSupport1717100000000,
  AddChatNotificationDigests1717200000000,
  AddMessageReplyAndEditedColumns1717300000000,
  MakeGroupAnchorLabelNullable1717400000000,
  AddGroupSendPermissions1717500000000,
];
