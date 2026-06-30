# Weekly-Updates: Lint & UI-Test Failures — Design

**Date:** 2026-07-01
**Branch:** `chore/000/weekly-updates`
**Status:** Approved

---

## Background

The `chore/000/weekly-updates` branch carries Renovate dependency bumps. After the
bumps, `just lint` and `just test-ui` both fail. Investigation confirmed **both
failures are collateral damage from the version bumps — no application source
regressed.** The relevant bumps:

- `typescript-eslint` `8.41.0 → 8.62.0` (root, `frontend`, `api-test`)
- `@radix-ui/react-dialog` `1.1.15 → 1.1.17` (frontend), which pulls
  `@radix-ui/react-dismissable-layer@1.1.13`

Two files need changes. Both are in the test/quality layer. **Zero production
source files change.**

---

## Failure 1 — Lint (`api-test`)

### Symptom

```
api-test/src/tests/maintenance-cards.spec.ts
   48:38  error  This assertion is unnecessary since the receiver accepts the
                 original type of the expression  @typescript-eslint/no-unnecessary-type-assertion
  459:38  error  (same)
✖ 2 problems (2 errors, 0 warnings)
```

### Root cause

`typescript-eslint@8.62`'s `no-unnecessary-type-assertion` rule now understands
that `toMatchObject(...)`'s parameter accepts the un-asserted expression type, so
two casts that were previously tolerated are now provably redundant:

- Line 49: `id: expect.any(String) as string`
- Line 468: `} as Partial<IMaintenanceCardResDTO>)`

Removing them changes nothing at runtime — `toMatchObject` already accepts the
un-asserted values. This is pure lint hygiene, auto-fixable.

### Fix

| Line | Before | After |
|---|---|---|
| 49 | `id: expect.any(String) as string,` | `id: expect.any(String),` |
| 468 | `} as Partial<IMaintenanceCardResDTO>);` | `});` |

If line 468's cast was the only consumer of the `IMaintenanceCardResDTO` import in
that file, leave the import — it is still used elsewhere (the `axiosInstance.get<IMaintenanceCardResDTO>`
generics at lines 41 and 453). No import removal expected; verify with lint.

---

## Failure 2 — UI test (`frontend`)

### Symptom

```
FAIL  src/components/ui/dialog.spec.tsx > Dialog > calls onOpenChange(false) when the overlay is clicked
AssertionError: expected "spy" to be called with arguments: [ false ]
Number of calls: 0
 ❯ src/components/ui/dialog.spec.tsx:71:26
```

### Root cause

`@radix-ui/react-dialog@1.1.17` configures its `Content` with
**`deferPointerDownOutside: true`** (verified in the dialog dist build).

In `@radix-ui/react-dismissable-layer@1.1.13`, deferred mode changed the dismiss
timing. With a left-button pointer (`event.button === 0`, the default for
`fireEvent.pointerDown`), the layer **no longer dispatches the outside-dismiss on
`pointerdown`**. Instead it registers a one-time `click` listener and dispatches
`onDismiss → onOpenChange(false)` on the subsequent **`click`**.

The existing test fires only `pointerDown` on the overlay and never a `click`, so
the dismiss path never runs → `onOpenChange` called 0 times.

In a real browser a user produces pointerdown → pointerup → click, so
overlay-click-to-close still works. `dialog.tsx` is unchanged and correct; the test
was coupled to the old (pre-defer) Radix dismiss timing and is now stale.

### Fix

Decision: **keep the behavioral test, fix the simulation to match the new
interaction** (rejected alternatives: drop Radix coupling for a contract-only test
— loses behavioral coverage; pin/revert Radix — fights the upgrade).

In the `'calls onOpenChange(false) when the overlay is clicked'` test, after the
`fireEvent.pointerDown(overlay!)` add the `click` and flush timers:

```ts
const overlay = document.querySelector('[data-radix-dialog-overlay]');
expect(overlay).not.toBeNull();
fireEvent.pointerDown(overlay!);
fireEvent.click(overlay!);          // Radix now defers the dismiss to the click
act(() => {
  vi.runAllTimers();                // flush the capture-phase setTimeout(0)
});
vi.useRealTimers();
expect(onOpenChange).toHaveBeenCalledWith(false);
```

Keep the existing fake-timer setup that registers Radix's deferred `pointerdown`
listener (the `act(() => vi.runAllTimers())` after render stays). Update the stale
explanatory comment so it documents the pointerdown→click deferral, e.g.:

```ts
// Radix DismissableLayer (deferPointerDownOutside: true) registers its pointerdown
// listener after a setTimeout(0), then defers the actual dismiss to the following
// click. Use fake timers to activate the listener, then simulate the full
// pointerdown -> click a real user produces.
```

---

## Validation

1. `just lint` → green (api-test errors gone, all 5 packages pass).
2. `just test-ui` → green (dialog.spec.tsx 5/5 pass, 391/391 total).

No new test files. Failure 2's corrected test is its own red→green: it fails today,
the corrected pointerdown→click simulation makes it pass against the real Radix
behavior. Failure 1 has no test — it is lint hygiene (removing dead casts).

---

## Out of scope

- No changes to `frontend/src/components/ui/dialog.tsx`.
- No Radix version pins or reverts.
- No changes to the other 390 passing UI tests or any backend/e2e suites.
