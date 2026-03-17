import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixIntervalMileageType1773757139082 implements MigrationInterface {
  name = 'FixIntervalMileageType1773757139082';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "maintenance_cards" ALTER COLUMN "interval_mileage" TYPE integer USING "interval_mileage"::integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "maintenance_cards" ALTER COLUMN "interval_mileage" TYPE numeric(10,2) USING "interval_mileage"::numeric`,
    );
  }
}
