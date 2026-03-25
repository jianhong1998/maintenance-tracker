# Plan 11: Frontend Home Page

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `/` home page — a vehicle grid that shows all of the authenticated user's vehicles, a global warning badge counting cards that are overdue or mileage-warning, and an "all good" state when the count is zero.

**Architecture:** Two new TanStack Query hooks — `useVehicles` (list) and `useMaintenanceCards(vehicleId)` — fetch data from the existing API. `QueryGroup` gains `VEHICLES` and `MAINTENANCE_CARDS` constants. A `VehicleCard` component renders one vehicle and independently fetches its cards to compute the per-vehicle warning count. The `HomeContent` component computes the global warning count using TanStack Query's `useQueries` (a single hook call that runs N parallel queries safely) — this avoids calling hooks inside a `.map()` loop, which would violate React's rules of hooks. TanStack Query deduplicates the card requests already fetched by `VehicleCard`. Mileage-warning computation follows the spec: remaining km = `(nextDueMileage - vehicleMileage) * (unit === 'mile' ? 1.60934 : 1)`; warn if `remainingKm <= mileageWarningThresholdKm`; overdue if `nextDueMileage < vehicleMileage` OR `nextDueDate < today`.

**Tech Stack:** TanStack Query v5, Next.js 15 App Router, `@project/types`, Tailwind CSS, shadcn/ui

**Spec reference:** `docs/superpowers/specs/2026-03-14-maintenance-tracker-design.md` — Section 6 (Frontend Structure: Home page, Maintenance Card UI)

**Prerequisites:** Plans 01–10 must be complete. `@project/types` exports `IVehicleResDTO`, `IMaintenanceCardResDTO`, `IAppConfigResDTO`. `useAppConfig` hook exists (Plan 07 frontend chunk).

---

## Chunk 1: Query Hooks

### Task 1: Add `VEHICLES` and `MAINTENANCE_CARDS` to `QueryGroup`

**Files:**
- Modify: `frontend/src/hooks/queries/keys/key.ts`

- [ ] **Step 1: Update `key.ts`**

In `frontend/src/hooks/queries/keys/key.ts`, update the `QueryGroup` object to include the two new groups:

```typescript
export const QueryGroup = Object.freeze({
  HEALTH_CHECK: 'health-check',
  CONFIG: 'config',
  VEHICLES: 'vehicles',
  MAINTENANCE_CARDS: 'maintenance-cards',
} as const);
export type QueryGroup = (typeof QueryGroup)[keyof typeof QueryGroup];
```

- [ ] **Step 2: Build to verify types compile**

```bash
cd frontend && pnpm build
```

Expected: No TypeScript errors.

- [ ] **Step 3: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/queries/keys/key.ts
git commit -m "feat: add VEHICLES and MAINTENANCE_CARDS to QueryGroup"
```

---

### Task 2: Create `useVehicles` hook

**Files:**
- Create: `frontend/src/hooks/queries/vehicles/useVehicles.ts`

- [ ] **Step 1: Create `useVehicles.ts`**

Create `frontend/src/hooks/queries/vehicles/useVehicles.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import type { IVehicleResDTO } from '@project/types';
import { apiClient } from '@/lib/api-client';
import { QueryGroup } from '../keys';

export const useVehicles = () => {
  return useQuery<IVehicleResDTO[]>({
    queryKey: [QueryGroup.VEHICLES],
    queryFn: () => apiClient.get<IVehicleResDTO[]>('/vehicles'),
  });
};
```

- [ ] **Step 2: Build to verify types compile**

```bash
cd frontend && pnpm build
```

Expected: No TypeScript errors.

- [ ] **Step 3: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/queries/vehicles/useVehicles.ts
git commit -m "feat: add useVehicles query hook"
```

---

### Task 3: Create `useMaintenanceCards` hook

**Files:**
- Create: `frontend/src/hooks/queries/maintenance-cards/useMaintenanceCards.ts`

- [ ] **Step 1: Create `useMaintenanceCards.ts`**

Create `frontend/src/hooks/queries/maintenance-cards/useMaintenanceCards.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import type { IMaintenanceCardResDTO } from '@project/types';
import { apiClient } from '@/lib/api-client';
import { QueryGroup } from '../keys';

export const useMaintenanceCards = (vehicleId: string) => {
  return useQuery<IMaintenanceCardResDTO[]>({
    queryKey: [QueryGroup.MAINTENANCE_CARDS, vehicleId],
    queryFn: () =>
      apiClient.get<IMaintenanceCardResDTO[]>(
        `/vehicles/${vehicleId}/maintenance-cards`,
      ),
    enabled: !!vehicleId,
  });
};
```

- [ ] **Step 2: Build to verify types compile**

```bash
cd frontend && pnpm build
```

Expected: No TypeScript errors.

- [ ] **Step 3: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/queries/maintenance-cards/useMaintenanceCards.ts
git commit -m "feat: add useMaintenanceCards query hook"
```

---

## Chunk 2: Warning Count Logic, VehicleCard, and HomePage

### Task 4: Create warning computation utility

**Files:**
- Create: `frontend/src/lib/warning.ts`

This pure utility is used by both the home page and the vehicle dashboard (Plan 12). It computes the warning status of a single maintenance card given the vehicle's current mileage, mileage unit, and the app-config threshold.

- [ ] **Step 1: Create `warning.ts`**

Create `frontend/src/lib/warning.ts`:

```typescript
import type { IMaintenanceCardResDTO } from '@project/types';

const MILES_TO_KM = 1.60934;

export type CardWarningStatus = 'overdue' | 'warning' | 'ok';

/**
 * Computes the warning status of a single maintenance card.
 *
 * - 'overdue'  — nextDueDate < today OR nextDueMileage < vehicleMileage
 * - 'warning'  — mileage remaining (in km) <= mileageWarningThresholdKm
 *                (only when card has intervalMileage)
 * - 'ok'       — all clear
 */
export function getCardWarningStatus(
  card: IMaintenanceCardResDTO,
  vehicleMileage: number,
  mileageUnit: 'km' | 'mile',
  mileageWarningThresholdKm: number,
): CardWarningStatus {
  const todayStr = new Date().toISOString().slice(0, 10);

  // Date-based overdue check
  if (card.nextDueDate && String(card.nextDueDate).slice(0, 10) < todayStr) {
    return 'overdue';
  }

  // Mileage-based overdue check
  if (card.nextDueMileage !== null && card.nextDueMileage < vehicleMileage) {
    return 'overdue';
  }

  // Mileage-based warning check (only when card has an interval_mileage)
  if (card.intervalMileage !== null && card.nextDueMileage !== null) {
    const remainingNative = card.nextDueMileage - vehicleMileage;
    const remainingKm =
      mileageUnit === 'mile' ? remainingNative * MILES_TO_KM : remainingNative;

    if (remainingKm <= mileageWarningThresholdKm) {
      return 'warning';
    }
  }

  return 'ok';
}

/**
 * Returns the count of cards that are either 'overdue' or 'warning'.
 */
export function countWarningCards(
  cards: IMaintenanceCardResDTO[],
  vehicleMileage: number,
  mileageUnit: 'km' | 'mile',
  mileageWarningThresholdKm: number,
): number {
  return cards.filter((card) => {
    const status = getCardWarningStatus(
      card,
      vehicleMileage,
      mileageUnit,
      mileageWarningThresholdKm,
    );
    return status === 'overdue' || status === 'warning';
  }).length;
}
```

- [ ] **Step 2: Build to verify types compile**

```bash
cd frontend && pnpm build
```

Expected: No TypeScript errors.

- [ ] **Step 3: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/warning.ts
git commit -m "feat: add getCardWarningStatus and countWarningCards utilities"
```

---

### Task 5: Create `VehicleCard` component

**Files:**
- Create: `frontend/src/components/vehicles/vehicle-card.tsx`

`VehicleCard` renders one vehicle row. It independently fetches the vehicle's maintenance cards, computes the warning count, and shows a badge. Clicking navigates to `/vehicles/:id`.

- [ ] **Step 1: Create `vehicle-card.tsx`**

Create `frontend/src/components/vehicles/vehicle-card.tsx`:

```typescript
'use client';

import Link from 'next/link';
import type { IVehicleResDTO } from '@project/types';
import { useMaintenanceCards } from '@/hooks/queries/maintenance-cards/useMaintenanceCards';
import { useAppConfig } from '@/hooks/queries/config/useAppConfig';
import { countWarningCards } from '@/lib/warning';

interface VehicleCardProps {
  vehicle: IVehicleResDTO;
}

export function VehicleCard({ vehicle }: VehicleCardProps) {
  const { data: cards = [] } = useMaintenanceCards(vehicle.id);
  const { data: config } = useAppConfig();

  const warningCount =
    config !== undefined
      ? countWarningCards(
          cards,
          vehicle.mileage,
          vehicle.mileageUnit,
          config.mileageWarningThresholdKm,
        )
      : 0;

  return (
    <Link
      href={`/vehicles/${vehicle.id}`}
      className="block rounded-lg border p-4 hover:bg-accent transition-colors"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">
            {vehicle.brand} {vehicle.model}
          </p>
          <p className="text-muted-foreground text-sm">{vehicle.colour}</p>
          <p className="text-muted-foreground text-sm">
            {vehicle.mileage.toLocaleString()} {vehicle.mileageUnit}
          </p>
        </div>
        {warningCount > 0 && (
          <span className="rounded-full bg-destructive px-2.5 py-0.5 text-xs font-semibold text-destructive-foreground">
            {warningCount}
          </span>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Build to verify types compile**

```bash
cd frontend && pnpm build
```

Expected: No TypeScript errors.

- [ ] **Step 3: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/vehicles/vehicle-card.tsx
git commit -m "feat: add VehicleCard component with per-vehicle warning badge"
```

---

### Task 6: Update `HomePage` with vehicle grid and global warning count

**Files:**
- Modify: `frontend/src/components/pages/home-page.tsx`

`HomePage` wraps everything in `AuthGuard`, fetches vehicles via `useVehicles`, and derives a global warning count using TanStack Query's `useQueries` — a single hook call that runs N parallel queries safely (no hooks-in-loop violation). TanStack Query deduplicates the card requests already issued by each `VehicleCard`.

- [ ] **Step 1: Update `home-page.tsx`**

Replace the contents of `frontend/src/components/pages/home-page.tsx` with:

```typescript
'use client';

import { useQueries } from '@tanstack/react-query';
import { AuthGuard } from '@/components/auth/auth-guard';
import { VehicleCard } from '@/components/vehicles/vehicle-card';
import { useVehicles } from '@/hooks/queries/vehicles/useVehicles';
import { useAppConfig } from '@/hooks/queries/config/useAppConfig';
import { countWarningCards } from '@/lib/warning';
import { QueryGroup } from '@/hooks/queries/keys';
import { apiClient } from '@/lib/api-client';
import type { IVehicleResDTO, IMaintenanceCardResDTO } from '@project/types';

/**
 * Computes the global warning count across all vehicles using useQueries.
 * useQueries is a single hook call that safely runs a dynamic number of
 * parallel queries — no hooks-in-loop violation.
 * TanStack Query deduplicates these fetches with VehicleCard's useMaintenanceCards calls.
 */
function useGlobalWarningCount(
  vehicles: IVehicleResDTO[],
  thresholdKm: number,
): number {
  const results = useQueries({
    queries: vehicles.map((vehicle) => ({
      queryKey: [QueryGroup.MAINTENANCE_CARDS, vehicle.id],
      queryFn: () =>
        apiClient.get<IMaintenanceCardResDTO[]>(
          `/vehicles/${vehicle.id}/maintenance-cards`,
        ),
      enabled: !!vehicle.id,
    })),
  });

  return results.reduce((total, result, index) => {
    const cards = result.data ?? [];
    const vehicle = vehicles[index];
    return (
      total +
      countWarningCards(
        cards,
        vehicle.mileage,
        vehicle.mileageUnit,
        thresholdKm,
      )
    );
  }, 0);
}

function HomeContent() {
  const { data: vehicles = [], isLoading } = useVehicles();
  const { data: config } = useAppConfig();
  const thresholdKm = config?.mileageWarningThresholdKm ?? 500;
  const globalWarningCount = useGlobalWarningCount(vehicles, thresholdKm);

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Loading vehicles…</p>;
  }

  if (vehicles.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No vehicles yet. Add your first vehicle to get started.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {globalWarningCount === 0 ? (
        <p className="text-sm font-medium text-green-600">
          ✓ All good — no upcoming or overdue maintenance
        </p>
      ) : (
        <p className="text-sm font-medium text-destructive">
          {globalWarningCount} card
          {globalWarningCount !== 1 ? 's' : ''} need attention
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {vehicles.map((vehicle) => (
          <VehicleCard key={vehicle.id} vehicle={vehicle} />
        ))}
      </div>
    </div>
  );
}

export function HomePage() {
  return (
    <AuthGuard>
      <main className="p-6">
        <h1 className="mb-4 text-xl font-semibold">Your Vehicles</h1>
        <HomeContent />
      </main>
    </AuthGuard>
  );
}
```

- [ ] **Step 2: Build to verify types compile**

```bash
cd frontend && pnpm build
```

Expected: No TypeScript errors.

- [ ] **Step 3: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/pages/home-page.tsx
git commit -m "feat: implement home page with vehicle grid and global warning count"
```

---

## Post-Implementation: Code Review — Round 1 (2026-03-24)

Review raised 4 issues. Analysis and resolution below.

---

### Issue 1 — `VehicleCard` fetches config it shouldn't own ✅ VALID — Fixed

**Reviewer claim:** `VehicleCard` calls `useAppConfig()` internally when the parent `HomeContent` already holds `thresholdKm`. This creates hidden coupling and a loading-state inconsistency: `HomeContent` defaults `thresholdKm` to `0` when config is loading (`?? 0`), while `VehicleCard` skipped the calculation entirely when config was `undefined`. During config load the global count and per-card badges could disagree.

**Fix:**
- Removed `useAppConfig()` from `VehicleCard`.
- Added `thresholdKm: number` to `VehicleCardProps`.
- `HomeContent` now passes `thresholdKm={thresholdKm}` to each `VehicleCard`.
- Updated `vehicle-card.spec.tsx`: removed `useAppConfig` mock, replaced the "config undefined" loading-state test with a `passes thresholdKm to countWarningCards` test.

**Files changed:**
- `frontend/src/components/vehicles/vehicle-card.tsx`
- `frontend/src/components/vehicles/vehicle-card.spec.tsx`
- `frontend/src/components/pages/home-page.tsx`

---

### Issue 2 — Dead export `getQueryKey` in `key.ts` ❌ INVALID

**Reviewer claim:** `getQueryKey` is used by neither `useVehicles` nor `useMaintenanceCards`, therefore it is dead code.

**Why invalid:** The reviewer only checked the two new hooks introduced in this branch. `getQueryKey` is actively used by `useAppConfig.ts` and `useBackendHealthCheck.ts` — pre-existing hooks that predate this branch. It is not dead code.

**No change made.**

---

### Issue 3 — Tautological tests in `key.spec.ts` ✅ VALID — Fixed

**Reviewer claim:** Tests asserting `QueryGroup.HEALTH_CHECK === 'health-check'` etc. are tautologies. They will never catch a real bug — if the string value changes, the test's hardcoded literal must also change, so the test provides zero protection.

**Fix:** Removed the 4 string-equality tests. Retained the `Object.isFrozen` test, which verifies actual runtime behaviour (immutability enforcement).

**Files changed:**
- `frontend/src/hooks/queries/keys/key.spec.ts`

---

### Issue 4 — `createWrapper()` duplicated across hook spec files ✅ VALID — Fixed

**Reviewer claim:** Identical `createWrapper()` factory copied verbatim into both `useMaintenanceCards.spec.ts` and `useVehicles.spec.ts`.

**Note on "inline setup in first test":** The first test in each spec file intentionally bypasses `createWrapper()` to retain a local `queryClient` reference needed for cache-inspection assertions (`queryClient.getQueryCache().findAll(...)`). This pattern is correct and was left as-is.

**Fix:** Extracted `createWrapper` to `frontend/src/hooks/queries/test-utils.ts`. Both spec files now import it from there.

**Files changed:**
- `frontend/src/hooks/queries/test-utils.ts` (new)
- `frontend/src/hooks/queries/maintenance-cards/useMaintenanceCards.spec.ts`
- `frontend/src/hooks/queries/vehicles/useVehicles.spec.ts`

---

## Post-Implementation: Code Review — Round 2 (2026-03-25)

Review raised 4 issues. 3 valid, 1 invalid.

---

### Issue 1 — First test in each hook spec still inlines QueryClient ✅ VALID — Fixed

**Reviewer claim:** The first test in `useMaintenanceCards.spec.ts` and `useVehicles.spec.ts` still hand-rolls `QueryClient` + `Wrapper` inline even though `test-utils.ts` was created in Round 1. The helper didn't expose the client, so the tests couldn't use it.

**Fix:** Added `createWrapperWithClient()` to `frontend/src/hooks/queries/test-utils.ts`. It returns `{ wrapper, queryClient }`, giving tests access to the client for cache-inspection assertions. Updated both spec files to use it.

**Files changed:**
- `frontend/src/hooks/queries/test-utils.ts`
- `frontend/src/hooks/queries/maintenance-cards/useMaintenanceCards.spec.ts`
- `frontend/src/hooks/queries/vehicles/useVehicles.spec.ts`

---

### Issue 2 — `home-page.spec.tsx` mocks `@tanstack/react-query` itself ✅ VALID — Fixed

**Reviewer claim:** The spec mocked `useQueries` from `@tanstack/react-query` to test `HomeContent` behavior. This tests whether you spelled `useQueries` correctly, not whether the component works correctly. If the implementation ever changes away from `useQueries`, the test breaks for the wrong reason.

**Root cause:** `useGlobalWarningCount` was a private function inside `home-page.tsx`, making it impossible to mock at a sensible boundary.

**Fix:** Extracted `useGlobalWarningCount` to `frontend/src/hooks/queries/vehicles/useGlobalWarningCount.ts` with its own spec. `home-page.tsx` now imports it. `home-page.spec.tsx` mocks `useGlobalWarningCount` directly — no TanStack internals touched.

**Files changed:**
- `frontend/src/hooks/queries/vehicles/useGlobalWarningCount.ts` (new)
- `frontend/src/hooks/queries/vehicles/useGlobalWarningCount.spec.ts` (new)
- `frontend/src/components/pages/home-page.tsx`
- `frontend/src/components/pages/home-page.spec.tsx`

---

### Issue 3 — Boundary condition: `nextDueMileage === vehicleMileage` returns 'warning' instead of 'overdue' ✅ VALID — Fixed

**Reviewer claim:** The mileage overdue check in `warning.ts` uses strict `<`. When `nextDueMileage === vehicleMileage`, the card falls through to the warning check. With `thresholdKm=0` (the `?? 0` default in `HomeContent` during config load), `0 <= 0` fires and returns `'warning'` — but a vehicle at exactly its service mileage is overdue, not just warning.

**Fix:** Changed `nextDueMileage < vehicleMileage` to `nextDueMileage <= vehicleMileage`. Added a test covering the exact-due-mileage case.

**Files changed:**
- `frontend/src/lib/warning.ts`
- `frontend/src/lib/warning.spec.ts`

---

### Issue 4 — Double computation of warning counts ❌ INVALID (known trade-off)

**Reviewer claim:** `useGlobalWarningCount` calls `countWarningCards` per vehicle, and each `VehicleCard` independently calls it too — so warning counts are computed twice per vehicle.

**Why invalid as an actionable item:** TanStack Query deduplicates the network fetches (one request per vehicle regardless of how many components ask). The computation (`countWarningCards`) is O(n) over a typically small card list — cheap enough that running it twice is not a real problem. Lifting all counts into `HomeContent` and passing them as props would couple the home page more tightly to VehicleCard's internal concerns. The reviewer noted this is "pre-existing" and "not urgent". Documented here as a known trade-off, not a defect.

**No change made.**
