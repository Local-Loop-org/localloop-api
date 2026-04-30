import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { UserEntity } from '@/modules/auth/infra/repositories/user.entity';
import { GroupOrmEntity } from '@/modules/groups/infra/repositories/group.entity';
import { GroupMemberOrmEntity } from '@/modules/groups/infra/repositories/group-member.entity';
import { GroupJoinRequestOrmEntity } from '@/modules/groups/infra/repositories/group-join-request.entity';
import { MessageOrmEntity } from '@/modules/messages/infra/repositories/message.entity';
import { InitialSetup1710770000000 } from '../migrations/1710770000000-InitialSetup';
import { CreateGroups1713700000000 } from '../migrations/1713700000000-CreateGroups';
import { CreateMessages1714000000000 } from '../migrations/1714000000000-CreateMessages';
import { AddGroupAnchorCoordinates1714500000000 } from '../migrations/1714500000000-AddGroupAnchorCoordinates';

config();

const databaseUrl = process.env.DATABASE_URL;

export default new DataSource({
  type: 'postgres',
  ...(databaseUrl
    ? { url: databaseUrl, ssl: { rejectUnauthorized: false } }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'localloop',
      }),
  entities: [
    UserEntity,
    GroupOrmEntity,
    GroupMemberOrmEntity,
    GroupJoinRequestOrmEntity,
    MessageOrmEntity,
  ],
  migrations: [
    InitialSetup1710770000000,
    CreateGroups1713700000000,
    CreateMessages1714000000000,
    AddGroupAnchorCoordinates1714500000000,
  ],
});
