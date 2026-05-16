import { UserEntity } from '@/modules/auth/infra/repositories/user.entity';
import { GroupOrmEntity } from '@/modules/groups/infra/repositories/group.entity';
import { GroupMemberOrmEntity } from '@/modules/groups/infra/repositories/group-member.entity';
import { GroupJoinRequestOrmEntity } from '@/modules/groups/infra/repositories/group-join-request.entity';
import { MessageOrmEntity } from '@/modules/messages/infra/repositories/message.entity';
import { DirectMessageOrmEntity } from '@/modules/direct-messages/infra/repositories/direct-message.entity';
import { PushDeviceOrmEntity } from '@/modules/notifications/infra/repositories/push-device.entity';

export const typeormEntities = [
  UserEntity,
  GroupOrmEntity,
  GroupMemberOrmEntity,
  GroupJoinRequestOrmEntity,
  MessageOrmEntity,
  DirectMessageOrmEntity,
  PushDeviceOrmEntity,
];
