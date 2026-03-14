# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm test                                          # Run all unit tests once
pnpm exec vitest run src/path/to/file.spec.ts      # Run a single test file
pnpm lint                                          # Lint
pnpm lint:fix                                      # Fix lint issues
pnpm format                                        # Format
pnpm run migration:generate --name=MigrationName   # Generate migration (builds first)
pnpm run migration:run                             # Run pending migrations
pnpm run seed:run                                  # Run seeders
```

## Architecture

NestJS app on port 3001 with TypeORM + PostgreSQL.

- `src/main.ts` — App entry point
- `src/configs/app.config.ts` — `AppConfig` with ConfigModule and TypeORM module setup
- `src/db/database.config.ts` — TypeORM DataSourceOptions; env vars: `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_DB`
- `src/db/entity-model.ts` — `ENTITY_MODELS` array; register every new TypeORM entity here
- `src/modules/app/` — Root app module
- `src/modules/common/` — Shared utilities and base classes
- `src/modules/common/base-classes/base-db-util.ts` — Abstract `BaseDBUtil<ModelType, CreationDataType>` providing `getOne`, `getAll`, `has`, `create`, `updateWithSave`, `delete` (soft delete). Extend this for all repository utilities.

## Conventions

- New features = new module folder under `src/modules/` with `controller`, `service`, `spec` files
- Unit tests: `src/**/*.spec.ts` using Vitest with SWC plugin (no `ts-jest`)
- Use `@nestjs/testing` `Test.createTestingModule` for unit tests; mock dependencies explicitly
- Shared request/response types come from `@project/types` — never define API contract types locally
- Migrations are generated from compiled JS (`dist/`), so `migration:generate` builds first
- Soft delete via TypeORM's `softRemove` — `BaseDBUtil.delete` handles this pattern
- Environment variables are loaded from root `.env` via `dotenv`
