import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGroupRadius1715000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE groups ADD COLUMN radius_km NUMERIC(5,2)`,
    );

    await queryRunner.query(
      `UPDATE groups SET radius_km = CASE anchor_type
         WHEN 'establishment' THEN 0.1
         WHEN 'condo'         THEN 0.1
         WHEN 'event'         THEN 0.5
         WHEN 'neighborhood'  THEN 2
         WHEN 'city'          THEN 50
         ELSE 5
       END`,
    );

    await queryRunner.query(
      `ALTER TABLE groups ALTER COLUMN radius_km SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE groups ALTER COLUMN radius_km SET DEFAULT 5`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE groups DROP COLUMN radius_km`);
  }
}
