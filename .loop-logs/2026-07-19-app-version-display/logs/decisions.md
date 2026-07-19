# Decisions & Challenges — 2026-07-19-app-version-display

## task-1-shared-version-type-in-project-types

### Key decisions
- Worktree had no `node_modules`; ran `pnpm install` once so `tsc` (build) and eslint could run. No source impact.

## task-2-backend-get-version-endpoint

### Key decisions
- Followed health-check DTO's plain `import { IVersionResDTO }` (not `import type`) — `VersionResDTO` is undecorated, so the `isolatedModules` + `emitDecoratorMetadata` constraint does not apply; lint/tsc pass.
- Built `@project/types` inside the worktree (dist is gitignored) after `pnpm install`, so the shared type resolves.
- Step 10 curl skipped: local services not running (non-blocking per plan).

## task-3-bake-the-version-into-the-image-docker-ci

### Key decisions
- Docker WAS available in this environment; both bake verifications were performed for real (not skipped). Default build printed `unreleased`; `--build-arg APP_VERSION=1.2.3-test` printed `1.2.3-test`.
- circleci CLI WAS available; `circleci config validate .circleci/config.yml` → "Config file at .circleci/config.yml is valid."
- Worktree had no `node_modules`; ran `pnpm install --frozen-lockfile --ignore-scripts` so `just lint` (turbo) could execute.

## task-4-frontend-useversion-query-hook

### Key decisions
- `../test-utils` import verified correct: spec at `version/useVersion.spec.ts` resolves to `queries/test-utils.ts`; `createWrapper` exported there. No path change needed.

## task-5-display-the-version-in-appshell-sidebar-footer-mobile-strip

### Key decisions
- Fresh git worktree had no `node_modules`; ran `pnpm install` + `packages/types` build before the TDD loop so `@project/types` resolved.

## Review fixes

- **A1 (round 1, important):** Mobile version strip and bottom tab bar were two independent `fixed` elements, each computing its own `env(safe-area-inset-bottom)` offset. The tab bar's `h-12` is a fixed border-box height, so its top edge sits at exactly `3rem` from the viewport bottom regardless of inset — but the strip was positioned at `bottom: calc(3rem + inset)`, opening a gap of exactly `inset` pixels between the two on any notched device. Fix: merged both into one shared `fixed bottom-0` wrapper applying `pb-[env(safe-area-inset-bottom)]` exactly once, so the whole stack moves as a unit and the pieces stay flush regardless of inset. Confirmed structurally (0px gap) in round-2 verification.
- **A2 (round 1, important):** Presentation test asserted `getAllByText('1.1.2').length).toBeGreaterThan(0)` when both render sites (sidebar footer + mobile strip) are always present in the jsdom DOM simultaneously (`md:hidden` is CSS-only). Fix: tightened to `toHaveLength(2)`, so the test fails if either render site regresses away.
- **C1 (round 1, important):** `useVersion` used `getQueryKey({ type: QueryType.ONE, key: '' })` for a singleton resource — a category error, since `ONE` semantics imply an entity id and version has none. Fix: mirrored the existing `useAppConfig` singleton pattern (`queryKey: [QueryGroup.VERSION]`, flat key, with the same explanatory comment).
- **DOC1 (round 2, important):** `docs/codebase-related/002-frontend-convention.md`'s "Safe-area insets" table still documented the pre-this-branch padding value (`pb-[calc(3rem+...)]`) for the mobile content wrapper, but Task 5 (earlier in this same branch) had already changed the actual code to `4.25rem` to reserve room for the new version strip — a self-inflicted doc/code drift. Fix: updated the doc line to the correct value with a one-line breakdown (3rem tab bar + 1.25rem version strip) so it can't silently drift again.
