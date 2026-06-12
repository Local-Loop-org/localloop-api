import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGroupSendPermissions1717500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE message_permission_enum AS ENUM (
        'admin_only',
        'members_in_radius',
        'all_members'
      )
    `);
    await queryRunner.query(`
      ALTER TABLE groups
        ADD COLUMN send_text_perm  message_permission_enum NOT NULL DEFAULT 'all_members',
        ADD COLUMN send_media_perm message_permission_enum NOT NULL DEFAULT 'all_members'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE groups
        DROP COLUMN send_media_perm,
        DROP COLUMN send_text_perm
    `);
    await queryRunner.query(`DROP TYPE message_permission_enum`);
  }
}
