import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDirectMessages1717000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE direct_messages (
        id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        sender_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_id UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content      TEXT,
        media_url    TEXT,
        media_type   media_type_enum,
        is_deleted   BOOLEAN     NOT NULL DEFAULT false,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT chk_dm_distinct_participants CHECK (sender_id <> recipient_id)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_dm_conversation
      ON direct_messages (
        LEAST(sender_id, recipient_id),
        GREATEST(sender_id, recipient_id),
        created_at DESC
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS direct_messages`);
  }
}
