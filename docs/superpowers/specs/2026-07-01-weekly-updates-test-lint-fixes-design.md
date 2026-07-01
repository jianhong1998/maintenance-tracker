# Weekly-Updates: Lint & UI-Test Failures — Design

**Date:** 2026-07-01
**Branch:** `chore/000/weekly-updates`
**Status:** Approved (revised after investigation — see "Investigation correction" below)

---

## Background

The `chore/000/weekly-updates` branch carries Renovate dependency bumps. After the
bumps, `just lint` and `just test-ui` both fail. Investigation confirmed **the
failures are collateral damage from the version bumps — no application source
regressed.** Relevant bumps:

- `typescript-eslint` `8.41.0 → 8.62.0` (root, `frontend`, `api-test`, `backend`)
- `@radix-ui/react-dialog` `1.1.15 → 1.1.17` (frontend), pulling
  `@radix-ui/react-dismissable-layer@1.1.13`

## Investigation correction

An initial subagent reported the lint failure in `api-test`. That was a **turbo
build/lint race artifact**, not the real failure. `@typescript-eslint/no-unnecessary-type-assertion`
is a *type-aware* rule: its verdict depends on whether `@project/types` is built
when a package lints. `turbo.json`'s `lint` task has **no `dependsOn: ["^build"]`**,
so cross-package type-aware lint races the types build and flip-flops between runs.

Canonical state (verified by running `eslint` directly per package with
`@project/types` built):

| Package | Lint | Notes |
|---|---|---|
| `api-test` | ✅ clean | earlier "errors" were the race |
| `backend` | ❌ **9 errors** | stable — assertions on **local** entity types, build-independent |
| `frontend` | ✅ clean (lint) | dialog **test** fails separately |
| `e2e` | ✅ clean | |

Three changes result. All are in the test/quality/build-config layer; **zero
production application source changes.**

---

## Change 1 — Backend lint (9 redundant assertions)

### Symptom

```
backend/src/modules/notification/notification.service.spec.ts
   80:46  error  This assertion is unnecessary ...  @typescript-eslint/no-unnecessary-type-assertion
   81:52  error  (same)
  100:46  error  (same)
  111:46  error  (same)
  112:52  error  (same)
  125:46  error  (same)
backend/src/modules/scheduler/scheduler.service.spec.ts
  159:71  error  (same)
  202:71  error  (same)
  231:71  error  (same)
✖ 9 problems (9 errors, 0 warnings)  — all fixable with --fix
```

### Root cause

`typescript-eslint@8.62`'s `no-unnecessary-type-assertion` now proves these casts
are no-ops because the receiver (`mockResolvedValue(...)`) accepts the un-asserted
expression type:

- `notification.service.spec.ts`: six `... mockResolvedValue(card as never)` /
  `mockResolvedValue(undefined as never)` / `mockResolvedValue(null as never)`
  casts (lines 80, 81, 100, 111, 112, 125).
- `scheduler.service.spec.ts`: three `mockResolvedValue({ id: 'job-1' } as BackgroundJobEntity)`
  casts (the `as BackgroundJobEntity` on lines 161, 204, 233; eslint anchors to the
  object-literal start at 159/202/231).

These assertions are compile-time only; Vitest+SWC strips them, so removing them
cannot change runtime behavior.

**Not flagged (leave untouched):** the `} as unknown as MaintenanceCardEntity`
double-assertions (scheduler lines 157/200/229) and the inline
`as { expiresAt: Date; jobType: string }` (line 209) — those are necessary and the
rule correctly does not flag them.

### Fix

Run `eslint --fix` (via `pnpm lint:fix`) in `backend`. The auto-fix deterministically
removes exactly the 9 redundant assertions:

- `card as never` → `card`; `undefined as never` → `undefined`; `null as never` → `null`
- `{ id: 'job-1' } as BackgroundJobEntity` → `{ id: 'job-1' }`

Then review `git diff` to confirm only those removals, and run the backend unit
suite to confirm green.

---

## Change 2 — turbo.json lint determinism (root-cause of the flake)

### Root cause

`turbo.json` `lint` and `lint:fix` tasks have no `dependsOn`, so they may run before
`@project/types` is built. Type-aware lint rules then resolve cross-package types
inconsistently, producing nondeterministic results (the `api-test` flip-flop, and a
latent risk that CI lint flakes).

### Fix

Add `"dependsOn": ["^build"]` to both `lint` and `lint:fix` in `turbo.json`, mirroring
the existing `build`/`test` tasks. Lint then always runs against built dependency
types — deterministic locally and in CI.

```jsonc
"lint":     { "dependsOn": ["^build"], "outputs": [] },
"lint:fix": { "dependsOn": ["^build"], "outputs": [] },
```

Trade-off: lint now builds upstream packages first (marginally slower on a cold
cache). Correctness and reproducibility outweigh it.

---

## Change 3 — UI test (frontend dialog overlay-dismiss)

### Symptom

```
FAIL  src/components/ui/dialog.spec.tsx > Dialog > calls onOpenChange(false) when the overlay is clicked
AssertionError: expected "spy" to be called with arguments: [ false ]
Number of calls: 0
 ❯ src/components/ui/dialog.spec.tsx:71:26
```

### Root cause

`@radix-ui/react-dialog@1.1.17` sets **`deferPointerDownOutside: true`** on its
Content (verified in the dialog dist build). In
`@radix-ui/react-dismissable-layer@1.1.13`, deferred mode + left button
(`event.button === 0`, the `fireEvent.pointerDown` default) **no longer dispatches
the outside-dismiss on `pointerdown`** — it registers a one-time `click` listener and
dispatches `onDismiss → onOpenChange(false)` on the following **`click`**.

The test fires only `pointerDown` on the overlay and never a `click`, so the dismiss
path never runs → `onOpenChange` called 0 times. In a real browser, a user produces
pointerdown → pointerup → click, so overlay-click-to-close still works. `dialog.tsx`
is unchanged and correct; the test was coupled to the old (pre-defer) Radix timing
and is now stale.

### Fix

Decision: **keep the behavioral test, fix the simulation to match the new
interaction** (rejected: drop Radix coupling for a contract-only test — loses
behavioral coverage; pin/revert Radix — fights the upgrade).

After `fireEvent.pointerDown(overlay!)` add `fireEvent.click(overlay!)` and flush
timers, and update the stale explanatory comment to document the pointerdown→click
deferral. (Exact code in the implementation plan.)

---

## Validation

1. `just lint` → green for all 5 packages, **deterministically** (re-run twice to
   confirm no flip).
2. `just test-ui` → green (dialog.spec.tsx 5/5, 391/391 total).
3. `just test-unit` (backend) → green (confirms the `--fix` removals didn't break the
   backend suite).

No new test files. Change 3's corrected test is its own red→green. Change 1 is lint
hygiene (removing dead casts). Change 2 is build-config robustness.

---

## Out of scope

- No changes to `frontend/src/components/ui/dialog.tsx` or any production source.
- No Radix version pins or reverts.
- No edits to `api-test` (canonically clean once lint is deterministic).
- No restructuring of test files or unrelated turbo tasks.
