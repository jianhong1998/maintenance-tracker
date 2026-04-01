import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateMileageToInt1775034444100 implements MigrationInterface {
  name = 'UpdateMileageToInt1775034444100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "maintenance_cards" DROP COLUMN "interval_mileage"`,
    );
    await queryRunner.query(
      `ALTER TABLE "maintenance_cards" ADD "interval_mileage" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "maintenance_cards" DROP COLUMN "next_due_mileage"`,
    );
    await queryRunner.query(
      `ALTER TABLE "maintenance_cards" ADD "next_due_mileage" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "maintenance_cards" DROP COLUMN "next_due_mileage"`,
    );
    await queryRunner.query(
      `ALTER TABLE "maintenance_cards" ADD "next_due_mileage" numeric(10,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "maintenance_cards" DROP COLUMN "interval_mileage"`,
    );
    await queryRunner.query(
      `ALTER TABLE "maintenance_cards" ADD "interval_mileage" numeric(10,2)`,
    );
  }
}
