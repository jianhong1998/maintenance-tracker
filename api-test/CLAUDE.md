# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

Integration tests that hit the running backend. These tests require all Docker services to be up (`just up-build` from root).

## Commands

```bash
pnpm test          # Run all api-tests once
pnpm test:watch    # Run in watch mode
pnpm lint          # Lint
pnpm lint:fix      # Fix lint issues
pnpm format        # Format
```

Run a single test file:

```bash
pnpm exec vitest run src/tests/path/to/file.spec.ts
```

## Structure

- `src/config/axios/` — Shared axios instance pointing to `http://localhost:3001`
- `src/constants/backend.constant.ts` — `BASE_URL` constant
- `src/tests/` — Test files grouped by feature (e.g., `health-check.spec.ts`)

## Conventions

- Tests use Vitest globals (`describe`, `it`, `expect`) — no imports needed for these
- All HTTP calls go through the shared `axiosInstance` from `src/config/axios/`
- Import shared response types from `@project/types` (workspace package)
- Test files follow naming: `<feature>.spec.ts`
- Group related tests under a `describe('#FeatureName')` block
- Tests validate both HTTP status codes and response payload shape using `toMatchObject`
