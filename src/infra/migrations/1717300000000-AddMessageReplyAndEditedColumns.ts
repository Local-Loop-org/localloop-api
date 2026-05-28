import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageReplyAndEditedColumns1717300000000 implements MigrationInterface {
  name = 'AddMessageReplyAndEditedColumns1717300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE messages
        ADD COLUMN reply_to_message_id UUID NULL
          REFERENCES messages(id) ON DELETE SET NULL,
        ADD COLUMN edited_at TIMESTAMPTZ NULL
    `);
    await queryRunner.query(`
      ALTER TABLE direct_messages
        ADD COLUMN reply_to_message_id UUID NULL
          REFERENCES direct_messages(id) ON DELETE SET NULL,
        ADD COLUMN edited_at TIMESTAMPTZ NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE direct_messages
        DROP COLUMN edited_at,
        DROP COLUMN reply_to_message_id
    `);
    await queryRunner.query(`
      ALTER TABLE messages
        DROP COLUMN edited_at,
        DROP COLUMN reply_to_message_id
    `);
  }
}
