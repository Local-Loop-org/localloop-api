import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGroups1713700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE groups (
        id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        name           VARCHAR(80) NOT NULL,
        description    TEXT,
        anchor_type    anchor_type_enum    NOT NULL,
        anchor_geohash CHAR(6)     NOT NULL,
        anchor_label   VARCHAR(100) NOT NULL,
        privacy        group_privacy_enum  NOT NULL DEFAULT 'open',
        owner_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        member_count   INT         NOT NULL DEFAULT 0,
        is_active      BOOLEAN     NOT NULL DEFAULT true,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_groups_anchor_geohash ON groups (anchor_geohash)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_groups_owner_id ON groups (owner_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE group_members (
        id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id   UUID        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role       member_role_enum   NOT NULL DEFAULT 'member',
        status     member_status_enum NOT NULL DEFAULT 'active',
        joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (group_id, user_id)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_group_members_group_id ON group_members (group_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_group_members_user_id ON group_members (user_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE group_join_requests (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id    UUID        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status      request_status_enum NOT NULL DEFAULT 'pending',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        resolved_at TIMESTAMPTZ,
        resolved_by UUID        REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_group_join_requests_pending
      ON group_join_requests (group_id, user_id)
      WHERE status = 'pending'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS group_join_requests`);
    await queryRunner.query(`DROP TABLE IF EXISTS group_members`);
    await queryRunner.query(`DROP TABLE IF EXISTS groups`);
  }
}
