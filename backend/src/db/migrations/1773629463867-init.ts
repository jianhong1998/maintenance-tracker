import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1773629463867 implements MigrationInterface {
  name = 'Init1773629463867';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"           uuid                     NOT NULL,
        "email"        character varying        NOT NULL,
        "firebase_uid" character varying        NOT NULL,
        "created_at"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at"   TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"),
        CONSTRAINT "UQ_0fd54ced5cc75f7cb92925dd803" UNIQUE ("firebase_uid"),
        CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."vehicles_mileage_unit_enum" AS ENUM('km', 'mile')
    `);

    await queryRunner.query(`
      CREATE TABLE "vehicles" (
        "id"           uuid                                        NOT NULL,
        "user_id"      uuid                                        NOT NULL,
        "brand"        character varying                           NOT NULL,
        "model"        character varying                           NOT NULL,
        "colour"       character varying                           NOT NULL,
        "mileage"      numeric(10,2)                               NOT NULL DEFAULT '0',
        "mileage_unit" "public"."vehicles_mileage_unit_enum"       NOT NULL DEFAULT 'km',
        "created_at"   TIMESTAMP WITH TIME ZONE                   NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMP WITH TIME ZONE                   NOT NULL DEFAULT now(),
        "deleted_at"   TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_18d8646b59304dce4af3a9e35b6" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."maintenance_cards_type_enum" AS ENUM('task', 'part', 'item')
    `);

    await queryRunner.query(`
      CREATE TABLE "maintenance_cards" (
        "id"                   uuid                                         NOT NULL,
        "vehicle_id"           uuid                                         NOT NULL,
        "type"                 "public"."maintenance_cards_type_enum"        NOT NULL,
        "name"                 character varying                            NOT NULL,
        "description"          character varying,
        "interval_mileage"     numeric(10,2),
        "interval_time_months" integer,
        "next_due_mileage"     numeric(10,2),
        "next_due_date"        date,
        "created_at"           TIMESTAMP WITH TIME ZONE                    NOT NULL DEFAULT now(),
        "updated_at"           TIMESTAMP WITH TIME ZONE                    NOT NULL DEFAULT now(),
        "deleted_at"           TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_903ca1d52f85644fe71c7f45e99" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "maintenance_histories" (
        "id"                  uuid                     NOT NULL,
        "maintenance_card_id" uuid                     NOT NULL,
        "done_at_mileage"     numeric(10,2),
        "done_at_date"        date                     NOT NULL,
        "notes"               text,
        "created_at"          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at"          TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_026a5e1504339e445bb8bd8b855" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."background_jobs_status_enum"
        AS ENUM('pending', 'processing', 'done', 'failed', 'cancelled')
    `);

    await queryRunner.query(`
      CREATE TABLE "background_jobs" (
        "id"               uuid                                        NOT NULL,
        "job_type"         character varying                           NOT NULL,
        "reference_id"     uuid,
        "reference_type"   character varying,
        "idempotency_key"  character varying                           NOT NULL,
        "payload"          jsonb                                       NOT NULL,
        "status"           "public"."background_jobs_status_enum"      NOT NULL DEFAULT 'pending',
        "scheduled_from"   TIMESTAMP WITH TIME ZONE                   NOT NULL,
        "expires_at"       TIMESTAMP WITH TIME ZONE                   NOT NULL,
        "last_attempted_at" TIMESTAMP WITH TIME ZONE,
        "created_at"       TIMESTAMP WITH TIME ZONE                   NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMP WITH TIME ZONE                   NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_47cb1d3c92d5f273035523a00e1" UNIQUE ("idempotency_key"),
        CONSTRAINT "PK_c1f31731b1a02806c4aa631acb8" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "vehicles"
        ADD CONSTRAINT "FK_88b36924d769e4df751bcfbf249"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "maintenance_cards"
        ADD CONSTRAINT "FK_5fb1428f4f64339bb2d4fd853b1"
        FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "maintenance_histories"
        ADD CONSTRAINT "FK_c1ae546d5f00a7677c491c377b6"
        FOREIGN KEY ("maintenance_card_id") REFERENCES "maintenance_cards"("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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

    await queryRunner.query(`DROP TABLE "background_jobs"`);
    await queryRunner.query(`DROP TYPE "public"."background_jobs_status_enum"`);
    await queryRunner.query(`DROP TABLE "maintenance_histories"`);
    await queryRunner.query(`DROP TABLE "maintenance_cards"`);
    await queryRunner.query(`DROP TYPE "public"."maintenance_cards_type_enum"`);
    await queryRunner.query(`DROP TABLE "vehicles"`);
    await queryRunner.query(`DROP TYPE "public"."vehicles_mileage_unit_enum"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
