import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1741996800000 implements MigrationInterface {
  name = 'InitialSchema1741996800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."background_jobs_status_enum" AS ENUM('pending', 'processing', 'done', 'failed', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "background_jobs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "job_type" character varying NOT NULL, "reference_id" uuid, "reference_type" character varying, "idempotency_key" character varying NOT NULL, "payload" jsonb NOT NULL, "status" "public"."background_jobs_status_enum" NOT NULL DEFAULT 'pending', "scheduled_from" TIMESTAMP WITH TIME ZONE NOT NULL, "ttl" TIMESTAMP WITH TIME ZONE NOT NULL, "last_attempted_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_background_jobs_idempotency_key" UNIQUE ("idempotency_key"), CONSTRAINT "PK_background_jobs" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "firebase_uid" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_users_firebase_uid" UNIQUE ("firebase_uid"), CONSTRAINT "PK_users" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."vehicles_mileage_unit_enum" AS ENUM('km', 'mile')`,
    );
    await queryRunner.query(
      `CREATE TABLE "vehicles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "brand" character varying NOT NULL, "model" character varying NOT NULL, "colour" character varying NOT NULL, "mileage" numeric(10,2) NOT NULL DEFAULT '0', "mileage_unit" "public"."vehicles_mileage_unit_enum" NOT NULL DEFAULT 'km', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "PK_vehicles" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."maintenance_cards_type_enum" AS ENUM('task', 'part', 'item')`,
    );
    await queryRunner.query(
      `CREATE TABLE "maintenance_cards" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "vehicle_id" uuid NOT NULL, "type" "public"."maintenance_cards_type_enum" NOT NULL, "name" character varying NOT NULL, "description" character varying, "interval_mileage" numeric(10,2), "interval_time_months" integer, "next_due_mileage" numeric(10,2), "next_due_date" date, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "PK_maintenance_cards" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "maintenance_histories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "maintenance_card_id" uuid NOT NULL, "done_at_mileage" numeric(10,2), "done_at_date" date NOT NULL, "notes" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_maintenance_histories" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "vehicles" ADD CONSTRAINT "FK_vehicles_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "maintenance_cards" ADD CONSTRAINT "FK_maintenance_cards_vehicle" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "maintenance_histories" ADD CONSTRAINT "FK_maintenance_histories_card" FOREIGN KEY ("maintenance_card_id") REFERENCES "maintenance_cards"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "maintenance_histories" DROP CONSTRAINT "FK_maintenance_histories_card"`,
    );
    await queryRunner.query(
      `ALTER TABLE "maintenance_cards" DROP CONSTRAINT "FK_maintenance_cards_vehicle"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vehicles" DROP CONSTRAINT "FK_vehicles_user"`,
    );
    await queryRunner.query(`DROP TABLE "maintenance_histories"`);
    await queryRunner.query(`DROP TABLE "maintenance_cards"`);
    await queryRunner.query(`DROP TYPE "public"."maintenance_cards_type_enum"`);
    await queryRunner.query(`DROP TABLE "vehicles"`);
    await queryRunner.query(`DROP TYPE "public"."vehicles_mileage_unit_enum"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "background_jobs"`);
    await queryRunner.query(`DROP TYPE "public"."background_jobs_status_enum"`);
  }
}
