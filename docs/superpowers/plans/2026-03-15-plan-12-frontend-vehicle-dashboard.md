# Plan 12: Frontend Vehicle Dashboard

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `/vehicles/:id` vehicle dashboard page — vehicle header, a once-per-day dismissible mileage update prompt (tracked via `localStorage`), an urgency/name sort toggle, and a colour-coded maintenance card list where each row shows name, type badge, and remaining mileage.

**Architecture:** Two new query hooks (`useVehicle`, updated `useMaintenanceCards` with optional `sort` param) and one mutation hook (`usePatchVehicle`) handle data. A `MileagePrompt` component reads and writes `localStorage` key `mileage_prompted_{vehicleId}_{YYYY-MM-DD}`. A `MaintenanceCardRow` component uses `getCardWarningStatus` (Plan 11) and `useAppConfig` to colour-code each row. A `VehicleDashboardPage` component wraps everything in `AuthGuard`. The App Router page at `app/vehicles/[id]/page.tsx` awaits `params` and delegates to the page component.

**Tech Stack:** TanStack Query v5 (`useQuery`, `useMutation`, `useQueryClient`), Next.js 15 App Router, `@project/types`, Tailwind CSS, `localStorage`

**Spec reference:** `docs/superpowers/specs/2026-03-14-maintenance-tracker-design.md` — Section 6 (Vehicle Dashboard, Mileage Update Prompt, Maintenance Card UI, Sort Options)

**Prerequisites:** Plans 01–11 complete. `getCardWarningStatus` is in `frontend/src/lib/warning.ts` (Plan 11). `AuthGuard` is in `frontend/src/components/auth/auth-guard.tsx` (Plan 10). `QueryGroup` includes `VEHICLES` and `MAINTENANCE_CARDS` (Plan 11).

---

## Chunk 1: Query and Mutation Hooks

### Task 1: Create `useVehicle` hook

**Files:**
- Create: `frontend/src/hooks/queries/vehicles/useVehicle.ts`

- [ ] **Step 1: Create `useVehicle.ts`**

Create `frontend/src/hooks/queries/vehicles/useVehicle.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import type { IVehicleResDTO } from '@project/types';
import { apiClient } from '@/lib/api-client';
import { QueryGroup } from '../keys';

export const vehicleQueryOptions = (vehicleId: string) => ({
  queryKey: [QueryGroup.VEHICLES, vehicleId] as const,
  queryFn: () => apiClient.get<IVehicleResDTO>(`/vehicles/${vehicleId}`),
  enabled: !!vehicleId,
});

export const useVehicle = (vehicleId: string) => {
  return useQuery<IVehicleResDTO>(vehicleQueryOptions(vehicleId));
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
git add frontend/src/hooks/queries/vehicles/useVehicle.ts
git commit -m "feat: add useVehicle query hook"
```

---

### Task 2: Update `useMaintenanceCards` to accept optional `sort` param

**Files:**
- Modify: `frontend/src/hooks/queries/maintenance-cards/useMaintenanceCards.ts`

The existing hook fetches without sorting. Adding an optional `sort` param threads it to the query string and the query key. The home page calls it without `sort` (key `[MAINTENANCE_CARDS, vehicleId]`); the dashboard calls it with `sort` (key `[MAINTENANCE_CARDS, vehicleId, sort]`) — separate cache entries by design.

- [ ] **Step 1: Update `useMaintenanceCards.ts`**

Replace the contents of `frontend/src/hooks/queries/maintenance-cards/useMaintenanceCards.ts` with:

```typescript
import { useQuery } from '@tanstack/react-query';
import type { IMaintenanceCardResDTO } from '@project/types';
import { apiClient } from '@/lib/api-client';
import { QueryGroup } from '../keys';

export const useMaintenanceCards = (
  vehicleId: string,
  sort?: 'urgency' | 'name',
) => {
  return useQuery<IMaintenanceCardResDTO[]>({
    queryKey: sort
      ? [QueryGroup.MAINTENANCE_CARDS, vehicleId, sort]
      : [QueryGroup.MAINTENANCE_CARDS, vehicleId],
    queryFn: () => {
      const qs = sort ? `?sort=${sort}` : '';
      return apiClient.get<IMaintenanceCardResDTO[]>(
        `/vehicles/${vehicleId}/maintenance-cards${qs}`,
      );
    },
    enabled: !!vehicleId,
  });
};
```

- [ ] **Step 2: Build to verify types compile**

```bash
cd frontend && pnpm build
```

Expected: No TypeScript errors. Existing call sites (`VehicleCard`, `useGlobalWarningCount`) that call `useMaintenanceCards(id)` without `sort` continue to compile.

- [ ] **Step 3: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/queries/maintenance-cards/useMaintenanceCards.ts
git commit -m "feat: add optional sort param to useMaintenanceCards"
```

---

### Task 3: Create `usePatchVehicle` mutation hook

**Files:**
- Create: `frontend/src/hooks/mutations/vehicles/usePatchVehicle.ts`

`usePatchVehicle` calls `PATCH /vehicles/:id` and on success updates the cached vehicle and invalidates the list so vehicle cards refresh.

- [ ] **Step 1: Create `usePatchVehicle.ts`**

Create `frontend/src/hooks/mutations/vehicles/usePatchVehicle.ts`:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { IPatchVehicleReqDTO, IVehicleResDTO } from '@project/types';
import { apiClient } from '@/lib/api-client';
import { QueryGroup } from '@/hooks/queries/keys';

export const usePatchVehicle = (vehicleId: string) => {
  const queryClient = useQueryClient();

  return useMutation<IVehicleResDTO, Error, IPatchVehicleReqDTO>({
    mutationFn: (data) =>
      apiClient.patch<IVehicleResDTO>(`/vehicles/${vehicleId}`, data),
    onSuccess: (updatedVehicle) => {
      queryClient.setQueryData(
        [QueryGroup.VEHICLES, vehicleId],
        updatedVehicle,
      );
      // exact: true targets only the list key [VEHICLES], not individual entries [VEHICLES, id]
      void queryClient.invalidateQueries({
        queryKey: [QueryGroup.VEHICLES],
        exact: true,
      });
    },
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
git add frontend/src/hooks/mutations/vehicles/usePatchVehicle.ts
git commit -m "feat: add usePatchVehicle mutation hook"
```

---

## Chunk 2: UI Components

### Task 4: Create `MileagePrompt` component

**Files:**
- Create: `frontend/src/components/vehicles/mileage-prompt.tsx`

`MileagePrompt` checks `localStorage` on mount. If today's key `mileage_prompted_{vehicleId}_{YYYY-MM-DD}` is absent, it renders a dismissible input. On submit or dismiss it sets the key and hides.

- [ ] **Step 1: Create `mileage-prompt.tsx`**

Create `frontend/src/components/vehicles/mileage-prompt.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { usePatchVehicle } from '@/hooks/mutations/vehicles/usePatchVehicle';
import { Button } from '@/components/ui/button';

interface MileagePromptProps {
  vehicleId: string;
}

function getTodayKey(vehicleId: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `mileage_prompted_${vehicleId}_${today}`;
}

export function MileagePrompt({ vehicleId }: MileagePromptProps) {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState('');
  const { mutate: patchVehicle } = usePatchVehicle(vehicleId);

  useEffect(() => {
    const key = getTodayKey(vehicleId);
    if (!localStorage.getItem(key)) {
      setVisible(true);
    }
  }, [vehicleId]);

  const dismiss = () => {
    localStorage.setItem(getTodayKey(vehicleId), '1');
    setVisible(false);
  };

  const handleSubmit = () => {
    patchVehicle({ mileage: parseFloat(value) });
    dismiss();
  };

  if (!visible) return null;

  return (
    <div className="rounded-lg border bg-muted p-4">
      <p className="mb-2 text-sm font-medium">
        What&apos;s your current odometer reading?
      </p>
      <div className="flex gap-2">
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter mileage"
          className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button size="sm" onClick={handleSubmit} disabled={!value}>
          Update
        </Button>
        <Button size="sm" variant="ghost" onClick={dismiss}>
          Dismiss
        </Button>
      </div>
    </div>
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
git add frontend/src/components/vehicles/mileage-prompt.tsx
git commit -m "feat: add MileagePrompt component with localStorage once-per-day gate"
```

---

### Task 5: Create `MaintenanceCardRow` component

**Files:**
- Create: `frontend/src/components/maintenance-cards/maintenance-card-row.tsx`

`MaintenanceCardRow` shows card name, type badge, remaining mileage (in the vehicle's native unit) or "OVERDUE", and colours the row based on `getCardWarningStatus`.

- [ ] **Step 1: Create `maintenance-card-row.tsx`**

Create `frontend/src/components/maintenance-cards/maintenance-card-row.tsx`:

```typescript
'use client';

import type { IMaintenanceCardResDTO, IVehicleResDTO } from '@project/types';
import { useAppConfig } from '@/hooks/queries/config/useAppConfig';
import { getCardWarningStatus } from '@/lib/warning';
import { cn } from '@/lib/utils';

const TYPE_LABELS: Record<IMaintenanceCardResDTO['type'], string> = {
  task: 'Task',
  part: 'Part',
  item: 'Item',
};

interface MaintenanceCardRowProps {
  card: IMaintenanceCardResDTO;
  vehicle: IVehicleResDTO;
}

export function MaintenanceCardRow({ card, vehicle }: MaintenanceCardRowProps) {
  const { data: config } = useAppConfig();
  const thresholdKm = config?.mileageWarningThresholdKm ?? 500;

  const status = getCardWarningStatus(
    card,
    vehicle.mileage,
    vehicle.mileageUnit,
    thresholdKm,
  );

  // Remaining mileage in the vehicle's native unit (null when no nextDueMileage)
  const remaining =
    card.nextDueMileage !== null ? card.nextDueMileage - vehicle.mileage : null;

  const mileageLabel = (() => {
    if (remaining === null) return null;
    if (remaining <= 0) return 'OVERDUE';
    return `${Math.round(remaining).toLocaleString()} ${vehicle.mileageUnit} left`;
  })();

  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-md border px-4 py-3',
        status === 'overdue' && 'border-destructive/40 bg-destructive/10',
        status === 'warning' && 'border-yellow-300 bg-yellow-50',
        status === 'ok' && 'bg-background',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{card.name}</span>
        <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
          {TYPE_LABELS[card.type]}
        </span>
      </div>

      {mileageLabel && (
        <span
          className={cn(
            'text-xs font-semibold',
            status === 'overdue' && 'text-destructive',
            status === 'warning' && 'text-yellow-700',
          )}
        >
          {mileageLabel}
        </span>
      )}
    </div>
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
git add frontend/src/components/maintenance-cards/maintenance-card-row.tsx
git commit -m "feat: add MaintenanceCardRow with colour-coded status and remaining mileage"
```

---

### Task 6: Create `VehicleDashboardPage` component

**Files:**
- Create: `frontend/src/components/pages/vehicle-dashboard-page.tsx`

`VehicleDashboardPage` is the full page component: `AuthGuard` wrapper, vehicle header, `MileagePrompt`, sort toggle, and card list using `MaintenanceCardRow`.

- [ ] **Step 1: Create `vehicle-dashboard-page.tsx`**

Create `frontend/src/components/pages/vehicle-dashboard-page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/auth/auth-guard';
import { MileagePrompt } from '@/components/vehicles/mileage-prompt';
import { MaintenanceCardRow } from '@/components/maintenance-cards/maintenance-card-row';
import { Button } from '@/components/ui/button';
import { useVehicle } from '@/hooks/queries/vehicles/useVehicle';
import { useMaintenanceCards } from '@/hooks/queries/maintenance-cards/useMaintenanceCards';

interface VehicleDashboardPageProps {
  vehicleId: string;
}

function DashboardContent({ vehicleId }: VehicleDashboardPageProps) {
  const [sort, setSort] = useState<'urgency' | 'name'>('urgency');
  const router = useRouter();

  const {
    data: vehicle,
    isLoading: vehicleLoading,
    isError,
  } = useVehicle(vehicleId);
  const { data: cards = [], isLoading: cardsLoading } = useMaintenanceCards(
    vehicleId,
    sort,
  );

  useEffect(() => {
    if (!vehicleLoading && (isError || !vehicle)) {
      router.replace('/');
    }
  }, [vehicleLoading, isError, vehicle, router]);

  if (vehicleLoading) {
    return <p className="text-muted-foreground p-6 text-sm">Loading…</p>;
  }

  if (isError || !vehicle) {
    return null;
  }

  return (
    <main className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">
          {vehicle.brand} {vehicle.model}
        </h1>
        <p className="text-muted-foreground text-sm">
          {vehicle.colour} &middot;{' '}
          {vehicle.mileage.toLocaleString()} {vehicle.mileageUnit}
        </p>
      </div>

      <MileagePrompt vehicleId={vehicleId} />

      <div className="flex gap-2">
        <Button
          size="sm"
          variant={sort === 'urgency' ? 'default' : 'outline'}
          onClick={() => setSort('urgency')}
        >
          Urgency
        </Button>
        <Button
          size="sm"
          variant={sort === 'name' ? 'default' : 'outline'}
          onClick={() => setSort('name')}
        >
          Name
        </Button>
      </div>

      {cardsLoading ? (
        <p className="text-muted-foreground text-sm">Loading cards…</p>
      ) : cards.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No maintenance cards yet.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {cards.map((card) => (
            <MaintenanceCardRow key={card.id} card={card} vehicle={vehicle} />
          ))}
        </div>
      )}
    </main>
  );
}

export function VehicleDashboardPage({ vehicleId }: VehicleDashboardPageProps) {
  return (
    <AuthGuard>
      <DashboardContent vehicleId={vehicleId} />
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
git add frontend/src/components/pages/vehicle-dashboard-page.tsx
git commit -m "feat: add VehicleDashboardPage with sort toggle, mileage prompt, and card list"
```

---

## Chunk 3: App Router Page and Smoke Test

### Task 7: Create the App Router page at `app/vehicles/[id]/page.tsx`

**Files:**
- Create: `frontend/src/app/vehicles/[id]/page.tsx`

This is a React Server Component (the default in App Router). It awaits `params` to extract `id`, then delegates to the client `VehicleDashboardPage` component.

- [ ] **Step 1: Create `app/vehicles/[id]/page.tsx`**

Create `frontend/src/app/vehicles/[id]/page.tsx`:

```typescript
import type { PageContext } from '@/types/page-context.type';
import { VehicleDashboardPage } from '@/components/pages/vehicle-dashboard-page';

type Props = PageContext<{ id: string }>;

export default async function VehiclePage({ params }: Props) {
  const { id } = await params;
  return <VehicleDashboardPage vehicleId={id} />;
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

- [ ] **Step 4: Smoke test**

```bash
just up-build
```

1. Open `http://localhost:3000` → sign in → vehicle grid loads.
2. Click a vehicle card → navigates to `/vehicles/:id`.
3. Vehicle header shows brand, model, colour, mileage.
4. On first visit today the mileage prompt appears. Enter a mileage and click "Update" → prompt disappears, vehicle mileage updates.
5. Reload → mileage prompt is suppressed (localStorage key is set).
6. Sort toggle switches between Urgency and Name — card order changes.
7. Cards with `nextDueDate < today` have red background. Cards within the mileage warning threshold have yellow background. Others have white/default background.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/vehicles/[id]/page.tsx
git commit -m "feat: add /vehicles/[id] App Router page for vehicle dashboard"
```

---

## Code Review Post-Mortem (2026-03-26)

### Issue 1 — `useMaintenanceCards` split cache keys

**Review claim:** The `sort ? { queryKey: [..., sort] } : maintenanceCardsQueryOptions(vehicleId)` ternary creates two divergent cache entries for the same resource and is a data design smell.

**Verdict: INVALID**

The separate cache entries are **intentional by design**. This plan (Task 2) states explicitly:

> "The home page calls it without `sort` (key `[MAINTENANCE_CARDS, vehicleId]`); the dashboard calls it with `sort` (key `[MAINTENANCE_CARDS, vehicleId, sort]`) — separate cache entries by design."

The home page fetches the unsorted card list; the dashboard fetches a server-sorted list. These are different response payloads — merging them into a single cache entry would mean either always sending `?sort=urgency` to the API (changing home page query behaviour) or losing sort granularity in the cache. The implementation deliberately keeps them separate.

The implementation also preserves the existing `maintenanceCardsQueryOptions` export for backward compatibility with `VehicleCard` and `useGlobalWarningCount`, which import it directly. This is a valid deviation from the plan's Task 2 code (which replaced the file entirely) in order to avoid breaking existing consumers.

**No fix required.**

---

### Issue 2 — `MileagePrompt.handleSubmit` silently discards mutation errors

**Review claim:** `dismiss()` fires synchronously before `patchVehicle` settles. If the mutation fails, the prompt disappears and localStorage is marked as seen, so the user believes mileage was saved when it wasn't.

**Verdict: VALID — Fixed**

`dismiss()` was moved into the `onSuccess` callback:

```ts
// Before
const handleSubmit = () => {
  patchVehicle({ mileage: parseFloat(value.trim()) });
  dismiss();
};

// After
const handleSubmit = () => {
  patchVehicle({ mileage: parseFloat(value.trim()) }, { onSuccess: dismiss });
};
```

Tests updated: the "calls patchVehicle and dismisses" test was split into two:
1. Verifies `patchVehicle` is called with `{ onSuccess: expect.any(Function) }` and that dismiss does NOT fire before mutation settles.
2. Simulates `onSuccess` firing synchronously and verifies dismiss then happens.

---

### Issue 3 — Warning colors not dark-mode aware

**Review claim:** `border-yellow-300 bg-yellow-50 text-yellow-700` are hardcoded light-mode colors with no `dark:` variants, inconsistent with `overdue` which uses CSS variable-based classes.

**Verdict: VALID — Fixed**

Dark mode IS active in this project (`@custom-variant dark (&:is(.dark *))` + `.dark { }` block in `globals.css`). Added dark variants:

```tsx
// Before
status === 'warning' && 'border-yellow-300 bg-yellow-50'
status === 'warning' && 'text-yellow-700'

// After
status === 'warning' && 'border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950'
status === 'warning' && 'text-yellow-700 dark:text-yellow-400'
```

Existing tests pass unchanged (they check for `bg-yellow-50`/`border-yellow-300` which are still present).

---

### Issue 4 — `usePatchVehicle` dual cache operations lack explanatory comment

**Review claim:** The comment `// Update the individual vehicle cache entry (no refetch)` followed immediately by `invalidateQueries` is contradictory without context explaining that `exact: true` targets only the list key.

**Verdict: VALID — Fixed**

Updated comment to clarify both cache operations:

```ts
// Before
// Update the individual vehicle cache entry (no refetch)
queryClient.setQueryData([QueryGroup.VEHICLES, vehicleId], updatedVehicle);
void queryClient.invalidateQueries({ queryKey: [QueryGroup.VEHICLES], exact: true });

// After
// Update the individual vehicle cache entry directly (no refetch for this entry)
queryClient.setQueryData([QueryGroup.VEHICLES, vehicleId], updatedVehicle);
// exact: true targets only the list key [VEHICLES], not individual [VEHICLES, id] entries
void queryClient.invalidateQueries({ queryKey: [QueryGroup.VEHICLES], exact: true });
```

---

### Implementation deviations from plan (minor, intentional)

| File | Plan | Implementation | Reason |
|---|---|---|---|
| `mileage-prompt.tsx` | `export function getTodayKey` not in plan | `getTodayKey` is exported | Tests (`mileage-prompt.spec.tsx`) import it directly to set/check localStorage keys |
| `mileage-prompt.tsx` | `disabled={!value}` | `disabled={!value.trim() \|\| isNaN(parseFloat(value))}` | Stricter validation prevents submitting whitespace-only or non-numeric input |
| `maintenance-card-row.tsx` | `status === 'ok' && 'bg-background'` in `cn()` | Omitted | The default background already resolves to `bg-background`; explicit class is redundant |
