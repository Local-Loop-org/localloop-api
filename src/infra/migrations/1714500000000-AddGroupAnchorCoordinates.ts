import { MigrationInterface, QueryRunner } from 'typeorm';
import * as ngeohash from 'ngeohash';

export class AddGroupAnchorCoordinates1714500000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE groups
         ADD COLUMN anchor_lat NUMERIC(9,6),
         ADD COLUMN anchor_lng NUMERIC(9,6)`,
    );

    const rows = (await queryRunner.query(
      `SELECT id, anchor_geohash FROM groups`,
    )) as Array<{ id: string; anchor_geohash: string }>;

    for (const row of rows) {
      const { latitude, longitude } = ngeohash.decode(row.anchor_geohash);
      await queryRunner.query(
        `UPDATE groups SET anchor_lat = $1, anchor_lng = $2 WHERE id = $3`,
        [latitude, longitude, row.id],
      );
    }

    await queryRunner.query(
      `ALTER TABLE groups
         ALTER COLUMN anchor_lat SET NOT NULL,
         ALTER COLUMN anchor_lng SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE groups DROP COLUMN anchor_lat, DROP COLUMN anchor_lng`,
    );
  }
}
