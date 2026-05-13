import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPushNotifications1716000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE push_permission_status_enum AS ENUM ('granted', 'denied', 'disabled')`,
    );
    await queryRunner.query(`CREATE TYPE push_provider_enum AS ENUM ('expo')`);
    await queryRunner.query(
      `CREATE TYPE device_platform_enum AS ENUM ('ios', 'android')`,
    );

    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN push_permission_status push_permission_status_enum
    `);

    await queryRunner.query(`
      CREATE TABLE push_devices (
        id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        installation_id VARCHAR(128) NOT NULL,
        provider        push_provider_enum NOT NULL,
        platform        device_platform_enum NOT NULL,
        token           TEXT        NOT NULL,
        enabled         BOOLEAN     NOT NULL DEFAULT true,
        last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        disabled_at     TIMESTAMPTZ,
        CONSTRAINT uq_push_devices_user_installation_provider
          UNIQUE (user_id, installation_id, provider)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_push_devices_user_id ON push_devices (user_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS push_devices`);
    await queryRunner.query(
      `ALTER TABLE users DROP COLUMN IF EXISTS push_permission_status`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS device_platform_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS push_provider_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS push_permission_status_enum`);
  }
}
