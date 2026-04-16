import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSetup1710770000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Extensions
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);

    // 2. Enums
    await queryRunner.query(`CREATE TYPE provider_enum AS ENUM ('google', 'apple')`);
    await queryRunner.query(`CREATE TYPE dm_permission_enum AS ENUM ('nobody', 'members', 'everyone')`);
    await queryRunner.query(`CREATE TYPE anchor_type_enum AS ENUM ('establishment', 'neighborhood', 'condo', 'event', 'city')`);
    await queryRunner.query(`CREATE TYPE group_privacy_enum AS ENUM ('open', 'approval_required')`);
    await queryRunner.query(`CREATE TYPE member_role_enum AS ENUM ('owner', 'moderator', 'member')`);
    await queryRunner.query(`CREATE TYPE member_status_enum AS ENUM ('active', 'pending', 'banned')`);
    await queryRunner.query(`CREATE TYPE media_type_enum AS ENUM ('image', 'video')`);
    await queryRunner.query(`CREATE TYPE request_status_enum AS ENUM ('pending', 'approved', 'rejected')`);

    // 3. User Table
    await queryRunner.query(`
      CREATE TABLE users (
        id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        provider_id   VARCHAR(255) NOT NULL,
        provider      provider_enum NOT NULL,
        display_name  VARCHAR(80)  NOT NULL,
        avatar_url    TEXT,
        geohash       CHAR(6),
        dm_permission dm_permission_enum NOT NULL DEFAULT 'members',
        is_active     BOOLEAN     NOT NULL DEFAULT true,
        last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (provider_id, provider)
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_users_geohash ON users (geohash)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
    await queryRunner.query(`DROP TYPE IF EXISTS provider_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS dm_permission_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS anchor_type_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS group_privacy_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS member_role_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS member_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS media_type_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS request_status_enum`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS postgis`);
  }
}
