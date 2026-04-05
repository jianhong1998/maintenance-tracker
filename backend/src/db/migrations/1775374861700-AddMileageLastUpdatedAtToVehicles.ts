import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMileageLastUpdatedAtToVehicles1775374861700
  implements MigrationInterface
{
  name = 'AddMileageLastUpdatedAtToVehicles1775374861700';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "vehicles" ADD "mileage_last_updated_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "vehicles" DROP COLUMN "mileage_last_updated_at"`,
    );
  }
}
