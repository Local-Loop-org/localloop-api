import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDmInboxSupport1717100000000 implements MigrationInterface {
  name = 'AddDmInboxSupport1717100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE dm_requests (
        id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        sender_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_id UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content      TEXT,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT chk_dm_req_distinct CHECK (sender_id <> recipient_id),
        UNIQUE (sender_id, recipient_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE dm_conversation_state (
        user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        peer_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        last_read_at TIMESTAMPTZ,
        archived     BOOLEAN     NOT NULL DEFAULT false,
        PRIMARY KEY (user_id, peer_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE dm_permission_exceptions (
        user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        allowed_peer_id UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, allowed_peer_id)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE dm_permission_exceptions`);
    await queryRunner.query(`DROP TABLE dm_conversation_state`);
    await queryRunner.query(`DROP TABLE dm_requests`);
  }
}
