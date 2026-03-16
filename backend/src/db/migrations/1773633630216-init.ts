import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1773633630216 implements MigrationInterface {
  name = 'Init1773633630216';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // -------------------------------------------------------------------------
    // Users
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"           UUID                     NOT NULL,
        "email"        CHARACTER VARYING        NOT NULL,
        "firebase_uid" CHARACTER VARYING        NOT NULL,
        "created_at"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at"   TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"),
        CONSTRAINT "UQ_0fd54ced5cc75f7cb92925dd803" UNIQUE ("firebase_uid"),
        CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")
      )
    `);

    // -------------------------------------------------------------------------
    // Vehicles
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TYPE "public"."vehicles_mileage_unit_enum" AS ENUM('km', 'mile')
    `);

    await queryRunner.query(`
      CREATE TABLE "vehicles" (
        "id"           UUID                                  NOT NULL,
        "user_id"      UUID                                  NOT NULL,
        "brand"        CHARACTER VARYING                     NOT NULL,
        "model"        CHARACTER VARYING                     NOT NULL,
        "colour"       CHARACTER VARYING                     NOT NULL,
        "mileage"      NUMERIC(10, 2)                        NOT NULL DEFAULT '0',
        "mileage_unit" "public"."vehicles_mileage_unit_enum" NOT NULL DEFAULT 'km',
        "created_at"   TIMESTAMP WITH TIME ZONE             NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMP WITH TIME ZONE             NOT NULL DEFAULT now(),
        "deleted_at"   TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_18d8646b59304dce4af3a9e35b6" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_88b36924d769e4df751bcfbf24" ON "vehicles" ("user_id")
    `);

    // -------------------------------------------------------------------------
    // Maintenance Cards
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TYPE "public"."maintenance_cards_type_enum" AS ENUM('task', 'part', 'item')
    `);

    await queryRunner.query(`
      CREATE TABLE "maintenance_cards" (
        "id"                   UUID                                       NOT NULL,
        "vehicle_id"           UUID                                       NOT NULL,
        "type"                 "public"."maintenance_cards_type_enum"     NOT NULL,
        "name"                 CHARACTER VARYING                          NOT NULL,
        "description"          CHARACTER VARYING,
        "interval_mileage"     NUMERIC(10, 2),
        "interval_time_months" INTEGER,
        "next_due_mileage"     NUMERIC(10, 2),
        "next_due_date"        DATE,
        "created_at"           TIMESTAMP WITH TIME ZONE                  NOT NULL DEFAULT now(),
        "updated_at"           TIMESTAMP WITH TIME ZONE                  NOT NULL DEFAULT now(),
        "deleted_at"           TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_903ca1d52f85644fe71c7f45e99" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_5fb1428f4f64339bb2d4fd853b" ON "maintenance_cards" ("vehicle_id")
    `);

    // -------------------------------------------------------------------------
    // Maintenance Histories
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "maintenance_histories" (
        "id"                  UUID                     NOT NULL,
        "maintenance_card_id" UUID                     NOT NULL,
        "done_at_mileage"     NUMERIC(10, 2),
        "done_at_date"        DATE                     NOT NULL,
        "notes"               TEXT,
        "created_at"          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at"          TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_026a5e1504339e445bb8bd8b855" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_c1ae546d5f00a7677c491c377b" ON "maintenance_histories" ("maintenance_card_id")
    `);

    // -------------------------------------------------------------------------
    // Background Jobs
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TYPE "public"."background_jobs_status_enum"
        AS ENUM('pending', 'processing', 'done', 'failed', 'cancelled')
    `);

    await queryRunner.query(`
      CREATE TABLE "background_jobs" (
        "id"               UUID                                     NOT NULL,
        "job_type"         CHARACTER VARYING                        NOT NULL,
        "reference_id"     UUID,
        "reference_type"   CHARACTER VARYING,
        "idempotency_key"  CHARACTER VARYING                        NOT NULL,
        "payload"          JSONB                                    NOT NULL,
        "status"           "public"."background_jobs_status_enum"   NOT NULL DEFAULT 'pending',
        "scheduled_from"   TIMESTAMP WITH TIME ZONE                NOT NULL,
        "expires_at"       TIMESTAMP WITH TIME ZONE                NOT NULL,
        "last_attempted_at" TIMESTAMP WITH TIME ZONE,
        "created_at"       TIMESTAMP WITH TIME ZONE                NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMP WITH TIME ZONE                NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_47cb1d3c92d5f273035523a00e1" UNIQUE ("idempotency_key"),
        CONSTRAINT "PK_c1f31731b1a02806c4aa631acb8" PRIMARY KEY ("id")
      )
    `);

    // -------------------------------------------------------------------------
    // Foreign Key Constraints
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      ALTER TABLE "vehicles"
        ADD CONSTRAINT "FK_88b36924d769e4df751bcfbf249"
        FOREIGN KEY ("user_id")
        REFERENCES "users"("id")
        ON DELETE NO ACTION
        ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "maintenance_cards"
        ADD CONSTRAINT "FK_5fb1428f4f64339bb2d4fd853b1"
        FOREIGN KEY ("vehicle_id")
        REFERENCES "vehicles"("id")
        ON DELETE NO ACTION
        ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "maintenance_histories"
        ADD CONSTRAINT "FK_c1ae546d5f00a7677c491c377b6"
        FOREIGN KEY ("maintenance_card_id")
        REFERENCES "maintenance_cards"("id")
        ON DELETE NO ACTION
        ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop FK constraints first
    await queryRunner.query(`
      ALTER TABLE "maintenance_histories"
        DROP CONSTRAINT "FK_c1ae546d5f00a7677c491c377b6"
    `);

    await queryRunner.query(`
      ALTER TABLE "maintenance_cards"
        DROP CONSTRAINT "FK_5fb1428f4f64339bb2d4fd853b1"
    `);

    await queryRunner.query(`
      ALTER TABLE "vehicles"
        DROP CONSTRAINT "FK_88b36924d769e4df751bcfbf249"
    `);

    // Drop background_jobs
    await queryRunner.query(`DROP TABLE "background_jobs"`);
    await queryRunner.query(`DROP TYPE "public"."background_jobs_status_enum"`);

    // Drop maintenance_histories
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c1ae546d5f00a7677c491c377b"`,
    );
    await queryRunner.query(`DROP TABLE "maintenance_histories"`);

    // Drop maintenance_cards
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5fb1428f4f64339bb2d4fd853b"`,
    );
    await queryRunner.query(`DROP TABLE "maintenance_cards"`);
    await queryRunner.query(`DROP TYPE "public"."maintenance_cards_type_enum"`);

    // Drop vehicles
    await queryRunner.query(
      `DROP INDEX "public"."IDX_88b36924d769e4df751bcfbf24"`,
    );
    await queryRunner.query(`DROP TABLE "vehicles"`);
    await queryRunner.query(`DROP TYPE "public"."vehicles_mileage_unit_enum"`);

    // Drop users
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
