# Code Review — Round 2

**Timestamp:** 2026-07-19T08:03:00Z
**Loop iteration:** 2 of ≤5

## Raw findings

### Reviewer A — enhanced-review (round 2)

## Review: app-version-display (post-fix, `3880e3e..HEAD`) — Code

### 【Taste Rating】 🟢 Good Taste
Small, well-shaped change; the 3 round-1 fixes each solved their stated problem without introducing new complexity. Verified: backend `src/modules/app/` 4/4 pass, frontend version+appshell specs 19/19 pass.

### Round-1 fix verification
- **Fix 1 (mobile geometry):** Solved cleanly — one shared `pb-[env(safe-area-inset-bottom)]` wrapper instead of two independently-insetting elements. Math checks out.
- **Fix 2 (test assertion):** Correct tightening to `toHaveLength(2)`.
- **Fix 3 (query key):** `[QueryGroup.VERSION]` now matches `useAppConfig` byte-for-byte.

### 【Findings】

**F1 — Mobile content reserves version-strip height even when version never resolves — 🟡 (low priority, not a ship blocker)**
Content wrapper padding is unconditional `pb-[calc(4.25rem+...)]` while the strip renders only `{version && ...}`. On total `/version` request failure (rare — service always falls back to `'unreleased'`), ~1.25rem dead space is reserved. Purely cosmetic, no occlusion.

**F2 — 'unreleased' fallback duplicated across Dockerfile + service — 🟢 accepted, no action** (defense-in-depth across build vs runtime layers, intentional).

**F3 — Dockerfile ARG placement & CI version selection — 🟢 accepted, no action** (correctly distinguished from the NODE_ENV runtime-gate pitfall; cache-friendly late layer).

### 【Final Verdict】 ✅ SHIP IT.

### Reviewer B — ponytail
skipped — plugin not installed

### Reviewer C — simplify (code-simplifier agent, round 2)

## Verdict: 🟢 Clean. No required changes.
Round-1 mobile restructure did not introduce new complexity — merging two independently-insetting fixed elements into one shared wrapper is the correct simplification.

**Note 1 (same root cause as Reviewer A's F1):** padding/strip-existence coupling — two values must stay in sync, no clean fix without measuring, acceptable as-is.

**Note 2 — doc drift (not in diff):** `frontend/CLAUDE.md` "Safe-area insets" table still says `Page content wrapper (mobile): pb-[calc(3rem+...)]`, but code changed to `4.25rem` in this branch's Task 5. Worth a one-line follow-up.

**Note 3 — test duplication in `useVersion.spec.ts`:** two tests share setup, differ only in final assertion. Mild, defensible as one-assertion-per-test. Not worth escalating.

**Note 4 — version `<span>` duplicated in two render sites:** explicitly "leave it — extracting a component for a single styled span would be over-engineering."

## Consolidated issues

| ID | Severity | Summary | Evidence (file:line) |
|----|----------|---------|----------------------|
| F1 | minor | Mobile content wrapper padding is unconditional while the version strip renders conditionally on `version` truthiness — dead space reserved only if `/version` permanently fails (rare, backend always falls back to `'unreleased'`). Zero functional impact, no occlusion. Unconditional padding also avoids a layout jump if version resolves late — arguably the right call. | `app-shell-presentation.tsx:119` (padding) vs `:125` (`{version &&` strip) |
| DOC1 | important | `frontend/CLAUDE.md`'s "Safe-area insets (iOS)" table documents the pre-this-branch value `pb-[calc(3rem+env(safe-area-inset-bottom))]` for the mobile content wrapper, but Task 5 (this same branch) changed the actual code to `4.25rem` to account for the new version strip. Self-inflicted doc/code drift — a future dev trusting the stale doc value could reintroduce content occlusion. | Stale: `frontend/CLAUDE.md` safe-area table; actual: `app-shell-presentation.tsx:119` |

## Disposition

- Actionable (blocking + important) — to fix this iteration: DOC1
- Deferred (minor — NOT handled yet): F1 — dead-space-on-total-failure edge case; both reviewers rate it low priority/optional; unconditional padding avoids a layout-jump special case, which is itself defensible good taste. No fix warranted.
