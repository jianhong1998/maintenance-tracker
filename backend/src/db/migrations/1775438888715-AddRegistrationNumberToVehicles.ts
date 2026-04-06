import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRegistrationNumberToVehicles1775438888715
  implements MigrationInterface
{
  name = 'AddRegistrationNumberToVehicles1775438888715';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "vehicles" ADD "registration_number" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "vehicles" DROP COLUMN "registration_number"`,
    );
  }
}
