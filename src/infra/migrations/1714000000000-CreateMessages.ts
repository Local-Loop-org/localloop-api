import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMessages1714000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE messages (
        id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id   UUID        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        sender_id  UUID        NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
        content    TEXT,
        media_url  TEXT,
        media_type media_type_enum,
        is_deleted BOOLEAN     NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_messages_group_created ON messages (group_id, created_at DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS messages`);
  }
}
