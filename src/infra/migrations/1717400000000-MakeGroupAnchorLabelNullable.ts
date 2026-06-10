import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeGroupAnchorLabelNullable1717400000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE groups
        ALTER COLUMN anchor_label DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE groups
      SET anchor_label = 'Selected location'
      WHERE anchor_label IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE groups
        ALTER COLUMN anchor_label SET NOT NULL
    `);
  }
}
