# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev       # Start dev server on port 3000 (Turbopack)
pnpm build     # Production build (Turbopack)
pnpm lint      # Lint
pnpm format    # Format
```

## Architecture

Next.js 15 App Router with TanStack Query for server state.

- `src/app/` — App Router pages and layouts
- `src/lib/api-client.ts` — Axios-based `apiClient` with typed methods (`get`, `post`, `put`, `patch`, `delete`). All API calls go through this; it also exports `ApiError` for error handling.
- `src/lib/query-client.ts` — TanStack Query client setup
- `src/hooks/queries/` — TanStack Query hooks, grouped by feature (e.g., `health-check/useBackendHealthCheck.ts`)
- `src/components/ui/` — shadcn/ui style presentational components
- `src/components/pages/` — Page-level components
- `src/components/providers/` — React context providers
- `src/constants/` — App-wide constants; `BACKEND_BASE_URL` reads from `FRONTEND_BACKEND_BASE_URL` env var (defaults to `http://localhost:3001`)

## Conventions

- API calls: use `apiClient` from `src/lib/api-client.ts`, never raw axios
- Server state: use TanStack Query hooks in `src/hooks/queries/<feature>/`; query keys live in `src/hooks/queries/keys/`
- Shared types from `@project/types` — never redefine API response shapes locally
- Refer other conventions in @../docs/codebase-related/002-frontend-convention.md .
