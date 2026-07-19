# Fix A1 + A2 — Mobile version strip safe-area geometry gap & weak test assertion

Branch: `fix/000/mobile-version-strip-geometry`
Worktree: `.worktrees/fix-a1-a2-mobile-geometry`
Final commit: `eab9e166d5bc392b97e0615651c0b5c7f35d4184` (`fix: 000 - fix mobile version strip safe-area gap and tighten version-render test assertion`)

## Finding A1 — mobile version strip geometry gap on notched devices

File: `frontend/src/components/layout/app-shell-presentation.tsx`

### Root cause
Previously the mobile version strip and the mobile tab bar were two independent
`fixed` elements:
- Strip: `bottom-[calc(3rem+env(safe-area-inset-bottom))] h-5`
- Nav: `bottom-0 h-12` with its own `pb-[env(safe-area-inset-bottom)]`

The tab bar's `h-12` is a fixed total (border-box) height, so its visible top
edge sits exactly `3rem` above the viewport bottom regardless of the safe-area
inset (the inset only eats internal content padding, not the box's total
height/position). But the strip was offset upward by the FULL inset on top of
`3rem`. On any device with a nonzero inset (notched iPhone ~34px) this left a
gap of exactly `env(safe-area-inset-bottom)` between the strip's bottom edge and
the tab bar's top edge.

### Fix
Wrapped both pieces in ONE `fixed inset-x-0 bottom-0` flex-column container that
applies `pb-[env(safe-area-inset-bottom)]` exactly once and carries the shared
`bg-[color:var(--bg-surface)]` and `z-40`. Inner pieces:
- Strip: `h-5 border-t border-[#00e5ff10]` (own bg + safe-area padding removed —
  now inherited from wrapper)
- Nav: `h-12 border-t border-[#00e5ff15]` (own `bg-*`, `z-40`, `fixed`,
  `bottom-0`, `inset-x-0`, and the double-applied `pb-[env(safe-area-inset-bottom)]`
  all removed; kept `aria-label="Mobile navigation"` and the unchanged nav-item
  mapping)

Both pieces now share a single safe-area inset and sit flush against each other,
the whole stack respecting the safe area as one unit. The page-content wrapper's
`pb-[calc(4.25rem+env(safe-area-inset-bottom))]` (3rem nav + 1.25rem strip +
inset) remains numerically correct for the combined stack height — left
unchanged.

## Finding A2 — weak test assertion

File: `frontend/src/components/layout/app-shell-presentation.spec.tsx`

Tightened the `'renders the version string when version is provided'` assertion
from `.length).toBeGreaterThan(0)` to `.toHaveLength(2)`. Version renders in
exactly 2 DOM locations in jsdom (sidebar footer + mobile strip; `md:hidden` is
CSS-only, not removed from the DOM). Confirmed 2 is the correct count both
before and after the A1 restructure — the restructure keeps the strip's single
`<span>{version}</span>` and the sidebar footer's `<span>{version}</span>`, so
the count is unchanged.

## TDD process followed
1. Read both files (line numbers had not drifted materially).
2. Tightened the assertion to `toHaveLength(2)` FIRST, ran the spec against the
   OLD (unfixed) component → PASS (17) — regression baseline established, proving
   the old component already rendered version in exactly 2 places.
3. Implemented the A1 JSX restructure.
4. Re-ran `pnpm exec vitest run src/components/layout/app-shell-presentation.spec.tsx`
   → PASS (17) FAIL (0). No pre-existing tests broken.

## Verification output
- Vitest (spec file): `PASS (17) FAIL (0)` after restructure.
- `just format`: 4 successful, 4 total (frontend files unchanged by formatter).
- `just lint`: `Tasks: 5 successful, 5 total`, `LINT_EXIT=0`.

## Note on Husky
The worktree's `.husky/_` wrapper dir (gitignored) was absent after `just
install`, so the first commit landed without the `fix: 000 -` prefix. Ran
`pnpm exec husky` to regenerate `.husky/_`, then `git commit --amend` — the
prepare-commit-msg hook then correctly prepended `fix: 000 - `. Final commit
subject: `fix: 000 - fix mobile version strip safe-area gap and tighten
version-render test assertion`.
