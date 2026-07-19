# fix-doc1-safe-area-docs

## What changed

Updated the stale mobile page-content-wrapper safe-area padding value in the
frontend convention doc to match the actual code.

- **Finding location correction:** The team-lead task pointed at `frontend/CLAUDE.md`,
  but the "Safe-area insets (iOS)" section and the stale line actually live in
  `docs/codebase-related/002-frontend-convention.md` (which `frontend/CLAUDE.md`
  references via `@../docs/codebase-related/002-frontend-convention.md`). Fixed the
  real location.
- **Edit:** `docs/codebase-related/002-frontend-convention.md`
  - Before: `- Page content wrapper (mobile): \`pb-[calc(3rem+env(safe-area-inset-bottom))]\``
  - After:  `- Page content wrapper (mobile): \`pb-[calc(4.25rem+env(safe-area-inset-bottom))]\` (4.25rem = 3rem tab bar + 1.25rem version strip stacked above it)`
- Confirmed against code: `frontend/src/components/layout/app-shell-presentation.tsx:119`
  uses `pb-[calc(4.25rem+env(safe-area-inset-bottom))]`.

## Lint

`just lint` in the fresh worktree failed with `turbo: command not found` — the worktree
has no `node_modules` (deps never installed). This is environmental, not caused by the
change. `turbo run lint` does not lint markdown, so a markdown-only edit is entirely out
of lint scope; nothing to catch either way.

## Husky note

The Husky prepare-commit-msg hook did NOT auto-prepend the prefix: worktree
`core.hooksPath=.husky/_`, but `.husky/_/` (git-ignored, created by `pnpm install`'s
prepare step) does not exist in this fresh worktree, so no hook fired. Amended the commit
with the explicit `docs: 000 - ` prefix manually.

## Final commit

`11e3ba3926b37a8a0271999018b8fba73c7ab200`
