# Tier 1 E2E Test Review — Linus-Style QA Verdict

Reviewer perspective: Principal QA Engineer + Linus-style code review.
Scope: Tier 1 specs (A1, B1, B3, B6, C1, C3, C4, D1, E2, F1, G1) plus shared
fixtures and global setup.

The job here is to **find problems**, not to validate that the tests run.
Several of these tests run green right now and would *stay* green while the
feature they exist to guard regresses. That is the worst kind of test.

---

## Headline Verdicts

| Spec | Taste rating       | One-liner                                                                                  |
|------|--------------------|--------------------------------------------------------------------------------------------|
| A1   | 🟡 Mediocre         | URL regex matches anything ending in slash. Eyebrow text duplication.                       |
| B1   | 🟡 Mediocre         | Loose accessible-name match; unstated `km` default; raw `#id` selectors.                    |
| B3   | 🟢 Good Taste*      | One real flaw: `heading.locator('..')` is the *only* bug-#001 guard, coupled to DOM shape.  |
| B6   | 🟢 Good Taste       | Strongest of the four. Same loose-name issue as B1.                                         |
| C1   | 🟡 Mediocre         | "Auto-calculated next-due values" never actually verified.                                  |
| C3   | 🟡 Mediocre         | Test name lies — interval change is never asserted. Setup is incoherent.                    |
| C4   | 🟢 Good Taste       | Best-shaped test in the batch.                                                              |
| D1   | 🔴 **Garbage**      | Pre-fill not asserted *and* not implemented. "5,000 km left" identical pre/post mark-done.  |
| E2   | 🟡 Mediocre         | DOM-walk for bug-#001 guard. Relies on undocumented backend default.                        |
| F1   | 🔴 **Garbage**      | Asserts label colour only, not row colour. Spec demands row colour.                         |
| G1   | 🟡 Mediocre         | Empty-fleet not asserted, status colour never asserted, date regex 100-day slop.            |

---

## Fatal Flaws (must fix)

### F1.1 — F1 doesn't test the F1 spec

**File:** `e2e/src/tests/f1-overdue-mileage.spec.ts:27`

The spec demands: **red row background**, "X KM PAST DUE" label, predictable
numeric. Test asserts only `text-[#ff4444]` on the *label*, never on the row
container. `getContainerClass('overdue')` returns `bg-[#ff44440a] border-[#ff444328]`
on the row (`maintenance-card-row.tsx:73-77`). If the row regresses to amber
while the label stays red, this test passes.

**Fix:** assert `data-status="overdue"` on the row (requires adding the
attribute), or assert both the row's bg/border classes AND the label text.

### F1.2 — D1 cannot distinguish no-op from success

**File:** `e2e/src/tests/d1-mark-done.spec.ts:24, 40`

Pre-state: vehicle 40k, due 45k → label `"5,000 km left"`. Post-state after
mark-done at 45k: vehicle 45k, due 50k → label `"5,000 km left"`. Same string.
If the mutation silently fails (PATCH returns 500 caught by an error boundary,
cache not invalidated), line 40 still passes.

**Fix:** API readback: `GET /vehicles/:id/maintenance-cards`, assert
`cards[0].nextDueMileage === 50000`. The `"X km left"` label is mathematically
incapable of validating mark-done because the formula reduces to the interval.

### F1.3 — D1 doesn't enforce the spec it claims to test

**File:** `e2e/src/tests/d1-mark-done.spec.ts:32` + `mark-done-dialog.tsx:31`

Spec D1: "mileage field required AND **pre-filled with current + interval**".
Test types `45000` manually. Pre-fill is never asserted. **And** the production
code at `mark-done-dialog.tsx:31` resets `doneAtMileage` to `''` on dialog open.
Spec, code, and test are in three-way disagreement, and the test is masking it.

**Fix:**
```ts
await expect(dialog.getByPlaceholder('Current odometer reading'))
  .toHaveValue('45000'); // BEFORE filling
```
Will fail today. That failure is the point.

### F1.4 — Bug-#001 guard rests on a DOM-walk trick

**Files:** `b3-vehicle-edit.spec.ts:39`, `e2-mileage-prompt.spec.ts:27-29`,
`d1-mark-done.spec.ts:38-40`

All three of the bug-#001 regression guards use `heading.locator('..')` to
reach the meta `<p>` containing colour + mileage. `..` walks one DOM level.
Today the parent of `<h1>` is the `min-w-0` div containing both heading and
meta. The day someone refactors the header into nested divs, all three guards
silently widen, narrow, or fail for the wrong reason. The bug-#001 regression
is too important to bolt onto DOM topology.

**Fix:** add `data-testid="vehicle-meta-line"` to the meta `<p>` at
`vehicle-dashboard-page.tsx:108`. Replace each `heading.locator('..')` with
two independent `toBeVisible()` assertions (heading + meta-line). Both
visible, in any layout, is the user contract.

---

## High-Severity Issues

### G1.1 — "Empty fleet" never asserted

**File:** `g1-onboarding.spec.ts:9-12`

Spec opens with "empty fleet". Test goes straight to `+ ADD VEHICLE` without
verifying empty state rendered. If the empty-state UX regresses (broken copy,
broken layout), G1 — the highest-value composite test — never notices.

### G1.2 — "Correct status" never asserted

**File:** `g1-onboarding.spec.ts:35-36, 47`

Spec: "each row renders with **correct status**". Test asserts label text only.
A mileage-only card with 20,000 km remaining is `ok` (cyan); a date-only card
with 365 days remaining is `ok`. If `getCardStatus` regresses to mark these as
warning or overdue, G1 still passes.

### G1.3 — Date regex allows 100-day drift

**File:** `g1-onboarding.spec.ts:47`

`/3\d\d days left/` matches 300–399. The expected value is ~365. The comment
claims this accounts for "a couple days of slack" — it accounts for a hundred.
Lock to `364|365|366`.

### C1 — Auto-calc not actually verified

**File:** `c1-card-create.spec.ts:34`

Spec: "card appears with **auto-calculated next-due values**" (plural). Test
asserts only `"5,000 km left"`. That label is `nextDueMileage − vehicleMileage`
— it can be off-by-one and still display "5,000". Auto-calculated `nextDueDate`
(months=6 in the form) is never verified at all.

**Fix:** API readback after save; assert `nextDueMileage === 25000` and
`nextDueDate` is ~6 months out.

### C3 — Test name lies

**File:** `c3-card-edit.spec.ts:5, 39-40`

Title: "row reflects new name AND interval after editing." Body asserts only
the new name and absence of the old name. Interval change `8000 → 10000` is
never asserted. PATCH could silently drop `intervalMileage` and the test stays
green.

### Foundation — `auth-popup.spec.ts` doesn't belong

**File:** `e2e/src/tests/auth-popup.spec.ts`

Doesn't match any spec in the test-cases doc. Imports `@playwright/test`
directly instead of the project fixture. Adds ~10s of CI time and a flake
surface for zero spec coverage.

**Fix:** delete or relocate to `manual/`.

### Foundation — DB never reset

**File:** `e2e/src/global-setup.ts:8-14`

`just db-data-reset` commented out with "TODO: wrong approach". Per-test
emulator users isolate user-scoped state, so vehicle/card tests are safe today.
But: F-series warning tests, F6 fleet aggregation, and any future global state
(feature flags, threshold config) will silently drift across runs.

**Fix:** programmatic reset — either a backend test-only endpoint
(`POST /test/reset` gated by `BACKEND_ENABLE_MOCK_AUTH`) or `pg`-direct
`TRUNCATE ... RESTART IDENTITY CASCADE` in `global-setup.ts`. Don't shell out
to `just`.

### Foundation — Type duplication with `@project/types`

**File:** `e2e/src/fixtures/api.ts:5-45`

`VehicleResponse`, `CardResponse`, `CreateVehicleInput`, `CreateCardInput` are
hand-rewritten. `IVehicleResDTO`, `ICreateVehicleReqDTO`, etc. exist in
`@project/types`. The string literal `mileageUnit: 'km' | 'mile'` is *guessing*
at the source of truth.

**Fix:** add `@project/types` workspace dep to `e2e/package.json` and import.

### Foundation — Missing API helpers force UI-driven setup

**File:** `e2e/src/fixtures/api.ts`

Missing: `apiUpdateVehicle`, `apiDeleteVehicle`, `apiUpdateCard`,
`apiDeleteCard`, `apiMarkCardDone`. Without these the next batch of specs
(B5, B7, C5, D2/D3, E1/E3/E4, F2/F3/F4/F5/F6) will hand-roll axios or, worse,
drive the UI to set up state. UI-as-setup is the single biggest source of
E2E flakiness.

---

## Medium-Severity Issues (representative — full list per spec below)

- **B1 line 21:** `km` default unstated. Mileage assertion `12,345 km` silently
  fails if form default flips to `mile`.
- **B1 line 26 / B6 line 27:** `getByRole('link', { name: /Toyota Corolla/i })`
  matches any link whose accessible name *contains* those tokens. Add
  `data-testid` on the card.
- **C3 lines 16-21:** seed has `intervalMileage: 8000, nextDueMileage: 18000`.
  Edit changes interval to 10000 but form pre-fills `nextDueMileage`, so
  saved value stays at 18000. Test asserts neither outcome — pins down nothing.
- **D1:** `intervalTimeMonths` not seeded. Out-of-scope for D1 strictly, but
  flag for D3 coverage.
- **E2 line 14:** relies on backend defaulting `mileageLastUpdatedAt = null`
  on vehicle create. Not documented anywhere. If backend changes that default,
  the prompt won't show and test goes red for the wrong reason.
- **F1 line 25:** label per source is `"5,000 km past due"` (lowercase). Spec
  says `"X KM PAST DUE"` (uppercase). Case-insensitive regex masks the
  discrepancy. Decide and lock case.
- **No `data-testid` discipline.** Every selector is text-based or id-based.
  Single largest flakiness multiplier across the suite. One PR adding
  `data-testid` to vehicle card, vehicle meta line, card row, edit/delete
  buttons, and the form inputs would fix four issues above and prevent the
  next twenty.
- **No page-object layer.** Each test hand-rolls selectors. 11 specs today,
  30 next month — each `aria-label` rename = 30 broken tests.

---

## Per-Spec Issue List (file:line citations)

### A1 — `a1-auth-login.spec.ts`

- 🟡 line 13: `toHaveURL(/\/$/)` matches any URL ending `/`. Use
  `(url) => url.pathname === '/'`.
- 🟡 line 14: `FLEET OVERVIEW` eyebrow text is duplicate signal — heading and
  `+ ADD VEHICLE` already prove fleet rendered. Drop or replace with a
  pre-login `/login` UI assertion (negative case for `AuthGuard`).

### B1 — `b1-vehicle-create.spec.ts`

- 🔴 line 26: loose accessible-name regex on `link`.
- 🟡 line 21: unstated `km` default.
- 🟡 lines 17-20: raw `#vehicle-brand` ids; prefer `getByLabel`.
- ℹ️  test isolation contract (per-user fresh emulator) is implicit; comment it.

### B3 — `b3-vehicle-edit.spec.ts`

- 🔴 line 39: `heading.locator('..').toContainText(/Red · 51,000 km/)` couples
  the bug-#001 regression guard to DOM topology. Two independent
  `toBeVisible()` assertions instead.
- 🟡 cache-invalidation regression (bug-#001 specifically) is silently caught
  by only one assertion. Lose `..` and you lose the guard.
- 🟢 uses `apiCreateVehicle` for setup — correct shape.
- ℹ️  registrationNumber path (plate flips primary label per
  `vehicle-display.ts:5-7`) not exercised. Strictly out of B3 scope, but worth
  a note for B-series coverage.

### B6 — `b6-vehicle-delete.spec.ts`

- 🟡 line 27: same loose-name match as B1.
- 🟡 line 20: variable `confirm` shadows `window.confirm`. Rename
  `confirmDialog`.
- 🟡 no API-side verification that DELETE actually hit the database. Add
  `apiGetVehicle(id)` → expect 404.

### C1 — `c1-card-create.spec.ts`

- 🔴 line 34: auto-calc verification is the spec's headline phrase and is not
  done. API readback for `nextDueMileage` and `nextDueDate`.
- 🟡 line 33-34: missing field assertions for type label, interval mileage
  display, interval months display.
- 🟡 line 33: regex-on-page text matches form placeholder if dialog stuck
  open. Scope to card list container.
- 🟡 lines 25-27: placeholder-based input selectors. Frontend's
  maintenance-card form has no `data-testid` — gap surfaced by this test.

### C3 — `c3-card-edit.spec.ts`

- 🔴 lines 5, 39-40: test title claims interval-change verification; body
  doesn't do it.
- 🟡 lines 16-21: incoherent setup data. Edit interval but next-due frozen by
  pre-fill.
- 🟡 line 40: `Tyre Rotation` count assertion page-wide — toast text or stale
  dialog state can confuse.
- 🟡 lines 26, 32, 34: `getByRole('button', { name: /actions/i })` works on
  one card, fails on N. Combine with row scoping.

### C4 — `c4-card-delete.spec.ts`

- 🟢 strongest test of the C-series. Empty-state assertion at line 34 is a
  strong signal.
- 🟡 line 26: `page.getByRole('dialog')` — scope by accessible name to be
  unambiguous.
- 🟡 no network-side verification.

### D1 — `d1-mark-done.spec.ts`

- 🔴 **Garbage tier overall.** Not the implementation's fault — the test
  pretends a feature works that the implementation doesn't actually do.
- 🔴 line 32: pre-fill not asserted, not implemented.
- 🔴 lines 24, 40: identical pre/post label cannot validate mark-done.
- 🟡 lines 38-40: bug-#001 guard misses the meta line.
- 🟡 lines 33-40: race timing on header re-render.
- 🟡 hard-coded comma formatting depends on locale; CI safe today, lock
  locale or use `/45[,. ]000 km/`.

### E2 — `e2-mileage-prompt.spec.ts`

- 🔴 lines 27-29: `heading.locator('..')` for the bug-#001 guard.
- 🟡 line 14: relies on backend default `mileageLastUpdatedAt = null` on
  create. Document or backdate explicitly.
- 🟡 line 21: redundant "UPDATE ODOMETER" text assertion. Replace with
  pre-submit vehicle-name-visible assertion (the *whole point* of bug-#001
  is the heading is visible *before AND after*).
- 🟡 line 23: no `waitForResponse(...)` around mutating click.

### F1 — `f1-overdue-mileage.spec.ts`

- 🔴 line 27: only label colour asserted, not row container colour.
- 🔴 line 25: case-insensitive regex hides "KM PAST DUE" vs "km past due".
- 🟡 lines 16-21: `intervalMileage` in seed is irrelevant to the assertion;
  inflates setup.
- 🟡 line 5: no "card actually rendered" precondition assertion.

### G1 — `g1-onboarding.spec.ts`

- 🔴 lines 9-12: empty-fleet state never asserted.
- 🔴 lines 35-36, 47: status colour for both cards never asserted.
- 🔴 line 47: 100-day date drift in regex.
- 🟡 line 22: assumes vehicle card is `<a>` with link role. Verify.
- 🟡 line 17: `mileageUnit` toggle default unstated (same issue as B1).
- 🟡 lines 31, 41: placeholder-based selectors on maintenance-card form
  (no `data-testid` on those inputs).
- 🟡 line 32: no assertion that "X days left" is *absent* from the
  mileage-only card (and vice versa).

### Foundation — `e2e/src/fixtures/`, `playwright.config.ts`, `global-setup.ts`

- 🔴 `auth-popup.spec.ts` doesn't belong.
- 🔴 DB reset commented out.
- 🟠 `api.ts` duplicates `@project/types`.
- 🟠 `loginAs` always traverses `/login` UI; only A1/A2/A3 need that.
- 🟠 missing API helpers (Update, Delete, MarkDone).
- 🟡 `as unknown as { __e2eAuth: ... }` casts — replace with `global.d.ts`.
- 🟡 hard-coded fallback URLs in three files; centralise + throw in CI when
  env vars unset.
- 🟡 no page-object layer.
- 🟡 `tsconfig.json` doesn't extend a base.

---

## Top 10 Fixes by ROI

1. **Add `data-testid` discipline** to: `VehicleCard`, vehicle meta `<p>`,
   `MaintenanceCardRow` (with `data-status`), card list container, vehicle
   edit/delete header buttons, mark-done mileage input, card form inputs.
   *Compounding ROI — fixes parts of A1/B1/B3/B6/C1/C3/D1/E2/F1/G1.*
2. **D1 line 32: assert pre-fill BEFORE filling.** Will fail today; reveals a
   real spec/code/test mismatch.
3. **D1: API readback `nextDueMileage` post-mark-done.** "X km left" cannot
   validate the mutation.
4. **F1: assert row container, not just label.** Currently F1 doesn't test F1.
5. **B3 / E2 / D1: replace `heading.locator('..')` with independent
   visible assertions.** Bug-#001 guard is the most important regression net
   in the suite.
6. **C1: API readback for `nextDueMileage` + `nextDueDate`.** Auto-calc is the
   spec headline.
7. **C3: assert interval change persisted.** Test title currently lies.
8. **G1: assert empty-fleet state and per-card status colour.** Composite test
   currently verifies 3 of 5 spec items.
9. **Delete `auth-popup.spec.ts`; replace DB-reset TODO with a real
   solution; import from `@project/types`; add missing API helpers
   (`apiUpdate*`, `apiDelete*`, `apiMarkDone`).** Foundation fixes that
   unblock the remaining specs.
10. **Tighten loose regexes:** A1's URL regex, F1's case-insensitive label,
    G1's date regex. Each currently passes for the wrong reasons.

---

## Linus Closing

> "Good code has no special cases."

Three of these tests currently pass while the feature they guard is broken
or misaligned with the spec. That is worse than not having them: a green
test board lies about coverage. The fixes above are not gold-plating — they
are what the tests need to actually be tests. Until then, treat A1/B1/B3/
B6/C1/C3/C4/D1/E2/F1/G1 as *drafts*, not as acceptance gates.
