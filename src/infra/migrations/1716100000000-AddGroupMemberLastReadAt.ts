import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGroupMemberLastReadAt1716100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE group_members
      ADD COLUMN last_read_at TIMESTAMPTZ
    `);

    await queryRunner.query(`
      UPDATE group_members gm
      SET last_read_at = COALESCE(
        (
          SELECT MAX(m.created_at)
          FROM messages m
          WHERE m.group_id = gm.group_id
            AND m.is_deleted = false
        ),
        gm.joined_at
      )
      WHERE gm.status = 'active'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE group_members
      DROP COLUMN last_read_at
    `);
  }
}
