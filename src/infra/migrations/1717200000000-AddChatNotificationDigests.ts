import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChatNotificationDigests1717200000000 implements MigrationInterface {
  name = 'AddChatNotificationDigests1717200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE chat_notification_digests (
        id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        recipient_user_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        conversation_key   VARCHAR(256) NOT NULL,
        type               VARCHAR(32)  NOT NULL,
        title              VARCHAR(160) NOT NULL,
        route_data         JSONB       NOT NULL,
        latest_message_id  UUID        NOT NULL,
        latest_sender_id   UUID,
        latest_sender_name VARCHAR(160),
        total_count        INTEGER     NOT NULL DEFAULT 1,
        snippets           JSONB       NOT NULL,
        last_message_at    TIMESTAMPTZ NOT NULL,
        created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_chat_notification_digests_recipient_conversation
          UNIQUE (recipient_user_id, conversation_key),
        CONSTRAINT chk_chat_notification_digests_type
          CHECK (type IN ('group_message', 'direct_message')),
        CONSTRAINT chk_chat_notification_digests_total_count
          CHECK (total_count > 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_chat_notification_digests_recipient_user_id
      ON chat_notification_digests (recipient_user_id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS chat_notification_digests`);
  }
}
