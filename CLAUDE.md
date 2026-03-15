# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All top-level commands go through `just` (delegating to TurboRepo/pnpm):

```bash
just up-build        # Build and start all Docker services (recommended for local dev)
just up              # Start all Docker services
just down            # Stop all Docker services

just build           # Build all workspaces (respects TurboRepo dependency order)
just format          # Format all workspaces
just lint            # Lint all workspaces
just lint-fix        # Fix lint issues across all workspaces
just install         # Reinstall all workspace dependencies

just test-unit       # Run backend unit tests (Vitest, backend/src/**/*.spec.ts)
just test-api        # Run API integration tests (requires running services)

just db-data-up      # Run database seeders
just db-data-reset   # Reset and reseed database
```

To run a single backend test file:

```bash
cd backend && pnpm exec vitest run src/path/to/file.spec.ts
```

To generate/run migrations:

```bash
cd backend && pnpm run migration:generate --name=MigrationName
cd backend && pnpm run migration:run
```

## Architecture

This is a **TurboRepo monorepo** with pnpm workspaces. Build order matters: `packages/types` → `backend` + `frontend`.

- **`packages/types`** — Shared TypeScript types/DTOs (`@project/types`). Both backend and frontend import from here. Always update types here when the API contract changes.
- **`backend/`** — NestJS app on port 3001. TypeORM + PostgreSQL. Feature code lives in `src/modules/`. New features = new module folder with controller/service/spec. Config bootstrapped via `AppConfig` in `src/configs/app.config.ts`.
- **`frontend/`** — Next.js 15 (App Router) on port 3000. TanStack Query for server state (`src/hooks/queries/`). API calls go through `src/lib/api-client.ts`. UI components in `src/components/ui/` (shadcn/ui style).
- **`api-test/`** — Vitest-based API/integration tests that hit the running backend. Runs separately from unit tests.

## Key conventions

- Backend unit tests: `src/**/*.spec.ts`, run via Vitest with SWC plugin
- Shared types must be built before backend/frontend (`turbo.json` enforces `^build` dependency)
- Environment variables sourced from root `.env` (see `.env.template`)
- Docker Compose services: `postgres`, `server` (NestJS), `client` (Next.js), `db-migration-service`

## Committing — Husky prepare-commit-msg hook

This repo has a Husky `prepare-commit-msg` hook (`.husky/prepare-commit-msg`) that **automatically prepends** a prefix to every commit message based on the branch name.

For a branch named `feat/000/create-something`, the hook rewrites `update db schema` → `feat: 000 - update db schema`.

**Before writing a commit message, always check whether Husky is active:**

```bash
cat .husky/prepare-commit-msg   # confirms the hook file exists
ls .git/hooks/prepare-commit-msg  # confirms it is installed in the repo
```

If the hook is installed and active, provide **only the bare description** as the commit message — no type prefix, no ticket ID. Let the hook add them.

- Correct: `git commit -m "update db schema"`
- Wrong: `git commit -m "feat: 000 - update db schema"` ← causes duplicate prefix

The hook skips merge commits, squash commits, and rebase operations automatically, so no special handling is needed for those.

## Project instructions

- Always use relevant skills.
- Always apply TDD when performing tasks.
- Always format code (command `just format`) and do lint check (command `just lint`) after editing code.
