# E2E Test Cases — Critical User Flows

Test flows for Playwright covering critical paths in the maintenance-tracker app.
Each flow represents a complete user journey; failure of any flow signals that a
recent change has broken a specific part of the application.

---

## Progress Tracker (Tier 1)

Status legend: `[ ]` not written · `[D]` draft written · `[R]` reviewed, fixes
required · `[✓]` reviewed, no blocking issues.

| Spec | Status | Headline finding (full review: `docs/raw-requirements/003-e2e/002-tier-1-review.md`) |
|------|--------|--------------------------------------------------------------------------------------|
| A1   | `[✓]`  | URL regex tightened to pathname check; eyebrow assertion kept as defense-in-depth.   |
| B1   | `[✓]`  | Loose link regex replaced with `vehicle-card-link` testid; mileage-unit comment locks the implicit km default. |
| B3   | `[✓]`  | Bug #001 guard now uses `vehicle-meta-line` testid + independent visibility — DOM topology no longer load-bearing. |
| B6   | `[✓]`  | Loose regex replaced with testid; `confirm` renamed; API readback (`apiGetVehicleStatus` → 404) now verifies DB-side delete. |
| C1   | `[✓]`  | API readback (`apiGetCards`) verifies both `nextDueMileage` and `nextDueDate` — the spec's "auto-calculated next-due values" phrase is now actually tested. |
| C3   | `[✓]`  | API readback (`apiGetCards`) verifies the persisted `intervalMileage` change — test no longer lies about what it asserts. |
| C4   | `[✓]`  | Best-shaped test of the batch — empty-state assertion is a strong signal.             |
| D1   | `[✓]`  | Seed numbers chosen so pre/post labels differ (`5,000 km left` → `7,000 km left`), pinning a real success/no-op gap; bug-#001 guard switched to the meta-line testid; pre-fill UX dropped (see updated D1 below). |
| E2   | `[✓]`  | Bug-#001 guard switched to the meta-line testid; the `mileageLastUpdatedAt = null` default is documented in `docs/codebase-related/001-architechture.md` §5/§12, not undocumented. |
| F1   | `[✓]`  | Row container now carries `data-status="overdue"` (production change in `MaintenanceCardRow`); test asserts that attribute and locks "5,000 km past due" to exact lowercase to match the implementation. |
| G1   | `[✓]`  | Empty-fleet asserted; both cards' `data-status="ok"` asserted; days regex tightened to `(364|365|366)`; cross-axis label absence asserted. |

### Foundation issues (affect every spec)

Resolved:
- `e2e/src/tests/auth-popup.spec.ts` — **deleted**. Did not map to any test-cases entry; A1/A2/A3 already cover login.
- `e2e/src/global-setup.ts` — TODO comment rewritten to document the actual rationale: per-test fresh emulator users isolate user-scoped data, so a DB reset is not required today. The comment now lists the conditions under which a real reset must be added (global state / cross-user aggregation / F-series mutations on shared rows) and points at the right replacement (backend endpoint guarded by `BACKEND_ENABLE_MOCK_AUTH`, not a `just` shell-out).
- `e2e/src/fixtures/api.ts` — now imports `IVehicleResDTO`, `ICreateVehicleReqDTO`, `IMaintenanceCardResDTO`, `ICreateMaintenanceCardReqDTO`, `IRecordMileageReqDTO`, and `MILEAGE_UNITS` from `@project/types`. Added minimal helpers needed by the resolved fixes: `apiGetCards` (C1, C3 readback) and `apiGetVehicleStatus` (B6 404 verify). Speculative `apiUpdate*`/`apiDelete*`/`apiMarkDone` deferred until a downstream spec actually needs them.
- Added load-bearing `data-testid` to a small set of high-value targets:
  - `VehicleCard`'s `<Link>` → `data-testid="vehicle-card-link"` (resolves loose accessible-name regex flagged in B1, B6, G1).
  - Vehicle dashboard meta `<p>` → `data-testid="vehicle-meta-line"` (replaces the `heading.locator('..')` topology trick in B3, E2, D1).
  - `MaintenanceCardRow` outer container → `data-testid="maintenance-card-row"` plus `data-status="overdue|warning|ok"` (resolves F1 row-container assertion, G1 status-colour assertion).

Rejected (with reasons):
- *POM / page-object layer.* 11 specs today; abstraction overhead exceeds the duplicated-selector cost. Revisit at ≥20 specs.
- *idToken-injection in `loginAs` (skip the `/login` UI for non-auth specs).* The current path already uses programmatic `__e2eAuth.signIn`, not the login button — only `page.goto('/login')` is UI. Wall-clock saving is small and A1/A2/A3 still need the UI traversal. YAGNI.
- *`as unknown as { __e2eAuth }` casts → `global.d.ts`.* Cosmetic. Defer.
- *Hard-coded fallback URLs in three files; centralise + throw in CI.* Solving a non-existent problem — fallbacks are explicit and CI sets the env vars.
- *`tsconfig.json` doesn't extend a base.* No shared base exists in the monorepo; introducing one for one consumer is overhead without payoff.
- *Speculative API helpers (`apiUpdate*`, `apiDelete*`, `apiMarkDone`).* YAGNI — added only the helpers actually needed by resolved Tier 1 fixes.

### Cross-cutting resolutions

- The bug-#001 regression guard (B3 + E2 + D1) now uses two independent
  visibility/text assertions against `[role="heading"]` and
  `[data-testid="vehicle-meta-line"]` — survives any future header layout
  change.
- `MaintenanceCardRow` carries `data-status="overdue|warning|ok"`. F1 and G1
  assert the attribute directly. Future F-series specs gain the same
  contract for free.
- API readback closed the no-op-vs-success gap where it actually mattered:
  C1 (`nextDueMileage` + `nextDueDate`), C3 (`intervalMileage`), B6
  (vehicle GET → 404). D1 closes the gap by seeding distinct interval
  numbers so the rendered "X km left" label changes across the mark-done
  call.

---

## A. Authentication Flows

### A1. Login success

Unauthenticated user visits `/`, gets redirected to `/login`, signs in via `__e2eAuth`, lands on `/` with fleet visible.

**Breaks if:** auth guard, Firebase config, session persistence, or login redirect regress.

### A2. Auth persistence

Logged-in user reloads the page on `/vehicles/:id` and stays on the same page (no redirect to `/login`).

**Breaks if:** session rehydration or AuthProvider regresses.

### A3. Logout / protected route

Directly navigating to `/vehicles/:id` while unauthenticated redirects to `/login`.

**Breaks if:** AuthGuard regresses.

---

## B. Vehicle CRUD Flows

### B1. Create vehicle (empty fleet)

Login → empty fleet shows "+ ADD VEHICLE" → fill form (brand, model, colour, mileage, unit) → submit → new card appears on home grid with correct brand/model/mileage.

**Breaks if:** vehicle form, POST `/vehicles`, home query invalidation, or card render regresses.

### B2. Create vehicle validation

Submit empty form → required-field errors shown; form does not close.

**Breaks if:** client-side validation regresses.

### B3. Edit vehicle

Open existing vehicle detail → click "Edit" → form pre-filled with current values → change colour + mileage → submit → detail header shows updated values.

**Breaks if:** form hydration, PATCH `/vehicles/:id`, or cache refresh regresses. This is the exact flow that bug #001 fixed — vehicle info must stay visible after mileage update.

### B4. Edit vehicle mileage validation

On edit form, enter a mileage lower than current → inline error shown, submit disabled.

**Breaks if:** validation in `VehicleFormDialog` regresses.

### B5. Edit vehicle unit locked

Vehicle with ≥1 maintenance card → open Edit form → unit toggle disabled with hint text.

**Breaks if:** unit-lock UX regresses.

### B6. Delete vehicle

Open vehicle detail → Delete → confirm dialog → confirm → redirect to `/` → card gone from grid.

**Breaks if:** DELETE endpoint, navigation after delete, or list invalidation regresses.

### B7. Navigate between fleet and detail

Click vehicle card from fleet → `/vehicles/:id` loads with header, mileage prompt (if applicable), card list → click back → return to fleet.

**Breaks if:** routing, Next.js App Router navigation, or split-pane layout regresses.

---

## C. Maintenance Card CRUD Flows

### C1. Create card on vehicle with no cards

Login → open vehicle detail → "+ ADD MAINTENANCE CARD" → fill name, type, interval mileage, interval months → submit → card appears in list with auto-calculated next-due values.

**Breaks if:** card form, auto-calc of `nextDueMileage`/`nextDueDate`, POST `/maintenance-cards`, or list render regresses.

### C2. Create card validation

Submit form with no intervals set (neither mileage nor months) → error "at least one interval required".

**Breaks if:** "at least one interval" validation regresses.

### C3. Edit card

Open card menu → Edit → change name + interval → submit → list row reflects new values.

**Breaks if:** card hydration, PATCH, or cache invalidation regresses.

### C4. Delete card

Open card menu → Delete → confirm → card removed from list.

**Breaks if:** delete dialog or endpoint regresses.

### C5. Sort toggle

Vehicle with ≥3 cards of varying urgency → toggle "URGENCY" vs "NAME" → row order changes accordingly.

**Breaks if:** sort logic regresses.

---

## D. Mark-Done Flow

Critical path — writes mileage and resets card next-due.

### D1. Mark done, mileage-based card

Card with `intervalMileage` set → menu → Mark Done → mileage field required (starts empty; user enters the actual odometer reading) → submit → card's next-due shifts forward; vehicle mileage updates on detail header.

> **Note (2026-04-28):** A prior version of this spec said "pre-filled with current + interval". The implementation in `mark-done-dialog.tsx` deliberately resets the field to `''` on dialog open so the user enters the actual odometer they recorded, not a pre-computed guess. The spec has been corrected to match the implementation.

**Breaks if:** POST `/maintenance-cards/:id/mark-done`, mileage write-through, or query invalidation regresses.

### D2. Mark done mileage validation

Enter a done-at mileage below current vehicle mileage → inline error, submit disabled.

**Breaks if:** bug #001 fix regresses.

### D3. Mark done, date-only card

Card with only `intervalTimeMonths` → Mark Done → no mileage input shown → submit → next due date shifts forward by N months.

**Breaks if:** conditional UI or date math regresses.

---

## E. Daily Mileage Prompt Flow

### E1. Prompt appears when due

Vehicle whose `mileageLastUpdatedAt` is before today → open detail → prompt visible above card list.

**Breaks if:** prompt's date comparison regresses.

### E2. Prompt submit updates mileage

Enter valid mileage → OK → prompt disappears, header mileage updates, vehicle name and other info still visible (bug #001 regression guard).

**Breaks if:** `usePatchVehicle` cache logic regresses.

### E3. Prompt dismiss persists for today

Click Dismiss → prompt hides → reload page → still hidden (localStorage).

**Breaks if:** localStorage key format or dismiss flow regresses.

### E4. Prompt validation

Enter mileage below current → inline error, OK disabled.

**Breaks if:** client-side validation regresses.

---

## F. Warning/Status Flows

Recent feature (#45) — high regression risk.

### F1. Overdue mileage shows red

Seed a card where `nextDueMileage <= vehicleMileage` → row carries `data-status="overdue"` (red background/border via `getContainerClass`) and renders the lowercase label "X km past due".

> **Note (2026-04-28):** Spec was previously written as "X KM PAST DUE" (uppercase). The implementation in `maintenance-card-row.tsx` emits the lowercase form, and the `.text-card-title`/`text-eyebrow` typography utilities are not applied to this label — the label renders as-emitted. Per "Never break userspace", the spec follows the code.

**Breaks if:** warning calculation in `lib/warning.ts` or status-to-color mapping regresses.

### F2. Warning mileage shows amber

Card within threshold (e.g. 400 km left when threshold=500) → amber row, "400 KM LEFT".

**Breaks if:** threshold read or color mapping regresses.

### F3. Overdue date shows red

Card where next due date is today or past → red row, "DUE TODAY" / "N DAYS OVERDUE".

**Breaks if:** date comparison regresses.

### F4. Warning date shows amber

Card due in ≤ `notificationDaysBefore` → amber row, "N DAYS LEFT".

**Breaks if:** date warning regresses.

### F5. Worst-of-both status

Card with mileage=ok but date=overdue → row renders red (worst axis wins).

**Breaks if:** status-reduction logic regresses.

### F6. Fleet badge aggregates warnings

Vehicle with ≥1 warning card → fleet card shows "N AT RISK" chip (red); vehicle with all-ok cards → "ALL GOOD" chip (cyan).

**Breaks if:** home-page warning aggregation regresses.

---

## G. End-to-End Composite Flows

The high-value multi-step user journeys.

### G1. Full onboarding

Login → empty fleet → add vehicle → navigate into it → add 2 maintenance cards (one mileage-only, one date-only) → each row renders with correct status.

**Breaks if:** any of auth → vehicle create → navigate → card create integration regresses.

### G2. Full maintenance cycle

Login → open vehicle → mark an overdue card done → status resets to ok (cyan) → fleet badge count decreases by 1.

**Breaks if:** write path + cache invalidation across pages regresses.

### G3. Update odometer flow

Login → open vehicle → mileage prompt appears → submit new mileage → card rows' "KM LEFT" labels recompute → affected card flips from ok → warning if crossed threshold.

**Breaks if:** mileage write + derived warning recompute regresses.

---

## H. Feature Flag Flows

### H1. Flag off hides nav

`enableHistory=false` → History tab absent from sidebar/bottom nav.

### H2. Flag off guards route

Directly visit `/history` with flag off → redirected to `/`.

### H3. Flag on exposes route

Toggle flag on (test-only override) → History tab visible and `/history` loads.

---

## Priority Tier 1

If only ~10 flows can be written first, prioritize: **A1, B1, B3, B6, C1, C3, C4, D1, E2, F1, G1**.

These collectively exercise every major write endpoint, cache invalidation path, navigation, and the status-calculation feature that has been changing recently. The rest are valuable but more defensive.
