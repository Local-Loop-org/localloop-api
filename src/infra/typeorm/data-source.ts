import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { UserEntity } from '@/modules/auth/infra/repositories/user.entity';
import { InitialSetup1710770000000 } from '../migrations/1710770000000-InitialSetup';

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
  entities: [UserEntity],
  migrations: [InitialSetup1710770000000],
});
