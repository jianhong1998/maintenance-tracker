# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm build     # Compile TypeScript to dist/ (required before backend/frontend can consume changes)
pnpm dev       # Watch mode compilation
pnpm clean     # Remove dist/
```

## Structure

- `src/dtos/` — DTO interfaces grouped by feature (e.g., `health-check.dto.ts`)
- `src/dtos/index.ts` — Re-exports all DTOs
- `src/index.ts` — Package entry; re-exports from `./dtos`
- `dist/` — Compiled output consumed by backend and frontend (not checked into git)

## Conventions

- All types are plain TypeScript interfaces — no classes, no decorators, no runtime dependencies
- Package name is `@project/types`; import as `import { IFooDTO } from '@project/types'`
- **Must run `pnpm build` after any change** before backend or frontend will see the update (TurboRepo handles this in `just build`, but not in watch mode)
- Add new feature DTOs as `src/dtos/<feature>.dto.ts` and re-export from `src/dtos/index.ts`
- Interface naming convention: `I<Name>ReqDTO` for request bodies, `I<Name>ResDTO` for responses
- **Enum-like values** — use a frozen `const` object with `as const` and derive the type from it. This provides named access (e.g. `MILEAGE_UNITS.KM`) while avoiding TypeScript enum nominal-type incompatibilities:
  ```typescript
  export const MILEAGE_UNITS = Object.freeze({
    KM: 'km',
    MILE: 'mile',
  } as const);
  export type MileageUnit = (typeof MILEAGE_UNITS)[keyof typeof MILEAGE_UNITS];
  ```
  Consumers use `MILEAGE_UNITS.KM` for named access and `Object.values(MILEAGE_UNITS)` in validators (e.g. `@IsIn(Object.values(MILEAGE_UNITS))`).
