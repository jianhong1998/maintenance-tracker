# Expiry Date Display on Maintenance Cards — Design

**Status:** Approved, ready for plan
**Date:** 2026-04-18
**Source requirement:** `docs/raw-requirements/002-ui-redesign/004-expiry-date/001-requirements.md`

---

## 1. Problem

Maintenance cards already track date-based expiry (`nextDueDate`) and the backend scheduler already sends email reminders using `NOTIFICATION_DAYS_BEFORE`. But the UI never surfaces date-based remaining days — users can only see mileage-based `X km left`. A card that is about to expire tomorrow looks identical to one that expires in six months, unless the user opens the edit dialog and reads the date.

This feature adds a symmetric date-based display to the card row, reusing the same three-tier colour system (ok / warning / overdue) already used for mileage.

## 2. Scope

**In:**
- Surface per-card date-based status and remaining-days label on `MaintenanceCardRow`.
- Extend `/config` to expose `notificationDaysBefore` to the frontend.
- Extend warning-status logic to report per-axis status (mileage, date) in addition to overall status.
- Update urgency sort to consider both axes.

**Out:**
- Singular/plural nuance beyond `"1 day"` vs `"N days"`.
- Timezone selection UI — rendering uses the browser's local TZ, matching current behaviour.
- Scheduler / email changes — it already consumes `NOTIFICATION_DAYS_BEFORE` directly.
- A second progress bar for the date axis.
- New sort modes (weighted cross-axis urgency, etc.).

## 3. Data model & config

**`IAppConfigResDTO`** (`packages/types/src/dtos/config.dto.ts`):

```ts
interface IAppConfigResDTO {
  mileageWarningThresholdKm: number;
  notificationDaysBefore: number;  // NEW
}
```

**Backend** (`backend/src/modules/config/config.controller.ts`):

```ts
notificationDaysBefore:
  this.configService.get<number>('NOTIFICATION_DAYS_BEFORE') ?? 7,
```

Source env var is `NOTIFICATION_DAYS_BEFORE` (already present in `.env.template`, already consumed by `SchedulerService`). Default `7` mirrors the existing mileage pattern.

**Frontend** reads via the existing `useAppConfig` hook. No new hook, no new cache key, no additional network call.

## 4. Status logic — `frontend/src/lib/warning.ts`

Replace the single-tier `getCardWarningStatus` with a per-axis + overall structure.

```ts
export type CardAxisStatus = 'overdue' | 'warning' | 'ok' | 'none';
// 'none' = axis not applicable (no mileage tracking / no date set)

export type CardStatus = {
  mileage: CardAxisStatus;
  date: CardAxisStatus;
  overall: 'overdue' | 'warning' | 'ok';
};

export const getCardStatus = (params: {
  card: IMaintenanceCardResDTO;
  vehicleMileage: number;
  mileageUnit: MileageUnit;
  mileageWarningThresholdKm: number;
  notificationDaysBefore: number;
}): CardStatus;
```

### 4.1 Mileage axis rules

| Condition                                                                 | Status    |
|---------------------------------------------------------------------------|-----------|
| `nextDueMileage === null`                                                 | `none`    |
| `nextDueMileage <= vehicleMileage`                                        | `overdue` |
| `intervalMileage !== null` AND `remainingKm <= mileageWarningThresholdKm` | `warning` |
| otherwise                                                                 | `ok`      |

(`remainingKm = (nextDueMileage - vehicleMileage)` converted to km if the unit is `mile`.)

### 4.2 Date axis rules

Let `daysUntilDue = floor((midnight(nextDueDate) - midnight(today)) / 86_400_000)` in the browser's local TZ.

| Condition                                             | Status    |
|-------------------------------------------------------|-----------|
| `nextDueDate == null`                                 | `none`    |
| `daysUntilDue <= 0` (includes "due today")            | `overdue` |
| `0 < daysUntilDue <= notificationDaysBefore`          | `warning` |
| otherwise                                             | `ok`      |

### 4.3 Overall

- `overdue` if either axis is `overdue`.
- else `warning` if either axis is `warning`.
- else `ok`.
- A card with both axes `none` is `ok`.

### 4.4 Migration of existing callers

`getCardWarningStatus` and `countWarningCards` remain available as thin wrappers over `getCardStatus(...).overall` so pre-existing callsites (`vehicles-layout.spec`, `vehicle-dashboard-page`, etc.) keep working. Migrate incrementally; delete the wrapper once unreferenced.

## 5. Row rendering — `frontend/src/components/maintenance-cards/maintenance-card-row.tsx`

### 5.1 Container colour

Driven by `status.overall`. Unchanged from today — just the new field name.

### 5.2 Right-aligned label stack

Two lines, both right-aligned, both `text-[0.625rem] font-bold`. **Mileage on top, date below** (mileage typically hits the threshold faster; top line is the first thing scanned).

```
                             1,000 km left      ← mileage line, coloured by status.mileage
                               5 days left      ← date line,    coloured by status.date
[Task]                                   ⋮
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   ← mileage progress bar
```

Rules:

- Render the mileage line iff `status.mileage !== 'none'`. Label text:
  - `overdue` → `"{|remaining|} {unit} past due"`
  - else → `"{remaining} {unit} left"`
- Render the date line iff `status.date !== 'none'`. Label text:
  - `overdue` AND `daysUntilDue === 0` → `"Due today"`
  - `overdue` AND `daysUntilDue < 0` → `"{|daysUntilDue|} days overdue"` (singular `"1 day"`)
  - else → `"{daysUntilDue} days left"` (singular `"1 day"`)
- If both axes are `none`, render nothing in the label slot (current behaviour).

### 5.3 Per-line colour

One helper, called once per axis:

```ts
const getAxisLabelColor = (params: {
  status: CardAxisStatus;    // 'overdue' | 'warning' | 'ok' (none never reaches here)
  remaining: number;         // km remaining for mileage; daysUntilDue for date
  threshold: number;         // mileageWarningThresholdKm or notificationDaysBefore
}): string;
```

- `overdue` → `text-[#ff4444]`
- `warning` → `text-[#f59e0b]`
- `ok` → `remaining > 3 * threshold` → `text-[#555]` (muted), else `text-[#00e5ff]` (cyan)

This replaces the inline `labelColorClass` IIFE and the standalone `getHealthyLabelColor` helper — one helper covers both axes.

### 5.4 Progress bar

Bar colour follows **`status.mileage`**, not `status.overall`. Rationale: the bar visualises mileage progress; if a card is mileage-`ok` but date-`overdue`, the container tints red (conveying overall urgency) while the mileage bar stays cyan (honestly reporting mileage state). Rendered iff `status.mileage !== 'none'`.

`getProgressFill` is unchanged.

## 6. Sorting — backend `MaintenanceCardService.listCards`

Sorting happens on the backend (`backend/src/modules/maintenance-card/services/maintenance-card.service.ts`, function `sortByUrgency`). The frontend already passes `?sort=urgency` to `GET /vehicles/:id/maintenance-cards` and the backend replies with a pre-sorted list. The new sort replaces the existing `sortByUrgency` function.

The service reads `MILEAGE_WARNING_THRESHOLD_KM` and `NOTIFICATION_DAYS_BEFORE` from `ConfigService` at list time (same pattern the scheduler already uses), then passes them together with `vehicle.mileage` and `vehicle.mileageUnit` into a pure comparator.

**Comparator signature** (new `backend/src/modules/maintenance-card/utils/card-sort.util.ts`):

```ts
export const compareCardsByUrgency = (params: {
  vehicleMileage: number;
  mileageUnit: MileageUnit;
  mileageWarningThresholdKm: number;
  notificationDaysBefore: number;
  today: Date;
}) => (a: MaintenanceCardEntity, b: MaintenanceCardEntity): number;
```

Sort keys, in order:

1. **Overall tier** — `overdue` (0) < `warning` (1) < `ok` (2). Tier is computed per-card with the same per-axis rules defined in §4 (operating on the entity — `nextDueDate` is a `Date`, `nextDueMileage` is `number | null`).
2. **Driver axis within tier:**
   - Mileage-driven (0) if `status.mileage === status.overall`.
   - Else date-driven (1) if `status.date === status.overall`.
   - Else "inert" (2) — applies only to `ok` cards with both axes `none`; sorted last within `ok`.
3. **Urgency within driver:**
   - Mileage-driven → ascending `nextDueMileage - vehicleMileage`.
   - Date-driven → ascending `daysUntilDue`.
   - Inert → no urgency key.
4. **Tiebreaker** — `card.name` via `localeCompare` for deterministic output.

**`getCardStatus` helper.** Extract the per-axis status rules into a pure helper (`backend/src/modules/maintenance-card/utils/card-status.util.ts`) used by `compareCardsByUrgency`. The frontend keeps its own copy in `frontend/src/lib/warning.ts` — the logic is short enough that cross-package sharing (via `@project/types` runtime code) is not worth the ceremony, and `@project/types` is typed-only by convention.

**Name-sort** — the `sort === 'name'` branch in `listCards` is unchanged.

## 7. Testing

### 7.1 Unit tests (TDD — red first, then implement)

- **`frontend/src/lib/warning.spec.ts`** — rewrite around `getCardStatus`:
  - 16-case matrix over `{mileage, date} × {none, ok, warning, overdue}` asserting per-axis + overall.
  - Date-axis edges: `daysUntilDue = -1, 0, 1, threshold, threshold+1, 3*threshold, 3*threshold+1`.
  - Back-compat: `getCardWarningStatus` wrapper returns `overall` for all 16 matrix cases.
- **`backend/src/modules/maintenance-card/utils/card-status.util.spec.ts`** (new) — 16-case matrix mirroring the frontend status spec, operating on `MaintenanceCardEntity`.
- **`backend/src/modules/maintenance-card/utils/card-sort.util.spec.ts`** (new) — table-driven:
  - Tier ordering (overdue before warning before ok).
  - Mileage-driven before date-driven within a tier.
  - Cards with both axes in the tier sort as mileage-driven (Option A).
  - Inert `ok` cards (both axes `none`) land last.
  - Urgency ordering within each driver.
  - Name tiebreaker; deterministic output for equal inputs.
- **`backend/src/modules/maintenance-card/services/maintenance-card.service.spec.ts`** — extend to assert `listCards(…, 'urgency')` calls the comparator with the right params and returns its output.
- **`frontend/src/components/maintenance-cards/maintenance-card-row.spec.tsx`** — extend:
  - Date label rendering for each axis status, including `"Due today"` and singular `"1 day"`.
  - 3× muted rule for the date axis.
  - Per-axis colour classes (mileage can be ok while date is overdue, and vice versa).
  - Bar colour follows `status.mileage` independently of `status.overall`.
  - Dual-label stack when both axes are present; single-label when only one axis; empty label slot when both `none`.
### 7.2 Backend tests

- **`backend/src/modules/config/config.controller.spec.ts`** — assert `notificationDaysBefore` is returned from the env var and defaults to `7` when unset.

### 7.3 API integration test

- **`api-test/src/tests/*`** — extend `/config` coverage to assert `notificationDaysBefore` is present and numeric.
- **`api-test/src/tests/maintenance-cards.spec.ts`** — add coverage for `?sort=urgency` returning the new tier ordering.

## 8. Risks & back-compat

| Risk                                                                    | Mitigation                                                                   |
|-------------------------------------------------------------------------|------------------------------------------------------------------------------|
| Removing `getCardWarningStatus` breaks callers                          | Keep it as a wrapper initially; delete only after grep confirms zero callers |
| Frontend crashes if `notificationDaysBefore` is missing from old clients| Hook has `staleTime: Infinity`; add a `??` fallback at the consumer          |
| Timezone drift at midnight                                              | All comparisons done on the `YYYY-MM-DD` string slice — same pattern used today |
| Sort non-determinism                                                    | `localeCompare` tiebreaker on name                                           |

## 9. File-change inventory

**New:**
- `backend/src/modules/maintenance-card/utils/card-status.util.ts`
- `backend/src/modules/maintenance-card/utils/card-status.util.spec.ts`
- `backend/src/modules/maintenance-card/utils/card-sort.util.ts`
- `backend/src/modules/maintenance-card/utils/card-sort.util.spec.ts`
- `frontend/src/constants/notification.ts` — `DEFAULT_NOTIFICATION_DAYS_BEFORE = 7`.

**Modified:**
- `packages/types/src/dtos/config.dto.ts` — add `notificationDaysBefore` to `IAppConfigResDTO`.
- `backend/src/modules/config/config.controller.ts` — populate the new field.
- `backend/src/modules/config/config.controller.spec.ts` — cover the new field.
- `backend/src/modules/maintenance-card/services/maintenance-card.service.ts` — delete the legacy `sortByUrgency`; have `listCards` pull env thresholds + vehicle info and call `compareCardsByUrgency`.
- `backend/src/modules/maintenance-card/services/maintenance-card.service.spec.ts` — cover the new sort path.
- `backend/src/modules/maintenance-card/maintenance-card.module.ts` — if needed, ensure `ConfigModule` is available (already imported globally via `AppConfig`, so likely no change).
- `frontend/src/lib/warning.ts` — add `getCardStatus`, keep `getCardWarningStatus` as a wrapper.
- `frontend/src/lib/warning.spec.ts` — rewrite for per-axis status.
- `frontend/src/components/maintenance-cards/maintenance-card-row.tsx` — dual label stack, bar colour from mileage axis, helper consolidation.
- `frontend/src/components/maintenance-cards/maintenance-card-row.spec.tsx` — cover new rendering rules.
- `frontend/src/constants/index.ts` — re-export from `notification.ts`.
- `api-test/src/tests/health-check.spec.ts` (or wherever `/config` is covered) — assert `notificationDaysBefore`.
- `api-test/src/tests/maintenance-cards.spec.ts` — cover the new urgency sort.
