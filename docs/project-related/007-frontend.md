# Frontend

## Plans Covered
- Plan 10: Auth & Layout (Firebase SDK, AuthProvider, AuthGuard, login page)
- Plan 11: Home Page (vehicle grid, warning counts)
- Plan 12: Vehicle Dashboard (mileage prompt, maintenance card list, sort)

---

## Plan 10 — Frontend Auth & Layout

**Goal:** Firebase Google Sign-in, `AuthProvider` with `onAuthStateChanged`, automatic `Authorization: Bearer` token injection on all API calls, `AuthGuard` that redirects unauthenticated users to `/login`.

### What was implemented

- **`frontend/src/lib/firebase.ts`** — Firebase app singleton with `getApps()` guard against hot-reload re-initialisation; validates required env vars at startup (`validateFirebaseEnv()`)
- **`AuthContext` + `AuthProvider`** — subscribes to `onAuthStateChanged`, provides `user`/`loading`/`signInWithGoogle`/`signOut`; wires token getter into `api-client.ts` via `setAuthTokenGetter`
- **`api-client.ts`** — axios request interceptor calls `getToken()` before every request to attach fresh Firebase ID token as `Authorization: Bearer`
- **`AuthGuard`** — client component: shows loading spinner, redirects to `/login` when unauthenticated, renders children when authenticated. Uses both `useEffect` (imperative redirect) and `return null` (suppress content flash) — these are orthogonal, not redundant.
- **`/login` page** — redirects authenticated users to `/`, shows "Sign in with Google" button
- **Root `layout.tsx`** — wraps app with `AuthProvider` inside `ReactQueryProvider`

### Key post-review fixes
- Added `'use client'` to `auth-context.tsx` (required for Next.js App Router)
- Added `isSigningIn` state to prevent double-click launching concurrent `signInWithPopup` calls
- Added error handling in `handleSignIn` with `signInError` state shown below the button
- Frontend Vitest + React Testing Library setup (16 tests across 4 files)

### Environment variables (prefix `FRONTEND_`)
- `FRONTEND_FIREBASE_API_KEY`
- `FRONTEND_FIREBASE_AUTH_DOMAIN`
- `FRONTEND_FIREBASE_PROJECT_ID`

### Key files
- `frontend/src/lib/firebase.ts`
- `frontend/src/contexts/auth-context.tsx`
- `frontend/src/components/providers/auth-provider.tsx`
- `frontend/src/lib/api-client.ts`
- `frontend/src/components/auth/auth-guard.tsx`
- `frontend/src/app/login/page.tsx`
- `frontend/src/app/layout.tsx`

---

## Plan 11 — Home Page

**Goal:** `/` home page — vehicle grid with per-vehicle warning badges, global warning count header, "all good" state.

### What was implemented

**Query hooks:**
- **`useVehicles`** — fetches `GET /vehicles`; `queryKey: [QueryGroup.VEHICLES]`
- **`useMaintenanceCards(vehicleId)`** — fetches `GET /vehicles/:id/maintenance-cards`; `queryKey: [MAINTENANCE_CARDS, vehicleId]`
- **`useGlobalWarningCount(vehicles, thresholdKm)`** — uses `useQueries` (single hook call for dynamic N parallel queries; no hooks-in-loop violation); TanStack Query deduplicates fetches already issued by `VehicleCard`

**Warning computation (`frontend/src/lib/warning.ts`):**
- `getCardWarningStatus(card, vehicleMileage, mileageUnit, thresholdKm)` → `'overdue' | 'warning' | 'ok'`
  - `'overdue'`: `nextDueDate < today` OR `nextDueMileage <= vehicleMileage` (equal = overdue)
  - `'warning'`: remaining km ≤ threshold (only when card has `intervalMileage`)
  - Mile-to-km conversion factor: `1.60934`
- `countWarningCards(cards, vehicleMileage, mileageUnit, thresholdKm)`

**Components:**
- **`VehicleCard`** — renders one vehicle; receives `thresholdKm` prop from parent (not `useAppConfig` directly — avoids config loading inconsistency)
- **`HomeContent`** — fetches vehicles + config, computes global warning count, renders grid

### Key post-review fixes
- `VehicleCard` removed `useAppConfig()` — moved `thresholdKm` to prop from parent
- Extracted `useGlobalWarningCount` to its own file (was private in `home-page.tsx`) — enables proper mocking in tests
- `nextDueMileage <= vehicleMileage` (was `<`) — exact due mileage is overdue, not warning
- `createWrapper`/`createWrapperWithClient` test utilities extracted to `test-utils.ts`
- Tautological `QueryGroup` string equality tests removed

### Key files
- `frontend/src/hooks/queries/vehicles/useVehicles.ts`
- `frontend/src/hooks/queries/maintenance-cards/useMaintenanceCards.ts`
- `frontend/src/hooks/queries/vehicles/useGlobalWarningCount.ts`
- `frontend/src/lib/warning.ts`
- `frontend/src/components/vehicles/vehicle-card.tsx`
- `frontend/src/components/pages/home-page.tsx`
- `frontend/src/hooks/queries/test-utils.ts`

---

## Plan 12 — Vehicle Dashboard

**Goal:** `/vehicles/:id` dashboard — vehicle header, once-per-day mileage update prompt, urgency/name sort toggle, colour-coded maintenance card list.

### What was implemented

**Query/mutation hooks:**
- **`useVehicle(vehicleId)`** — `queryKey: [VEHICLES, vehicleId]`; exports `vehicleQueryOptions` for reuse
- **`useMaintenanceCards(vehicleId, sort?)`** — updated to accept optional `sort` param; separate cache entries for sorted vs unsorted (intentional — different response payloads)
- **`usePatchVehicle(vehicleId)`** — `PATCH /vehicles/:id`; on success: dual `invalidateQueries` with `exact: true` — one for `[VEHICLES, vehicleId]` (individual entry), one for `[VEHICLES]` (list). `setQueryData` was removed (was writing to wrong cache key when `vehicleId` was empty string on first render). `mutationFn` also guards against empty `vehicleId` with an early throw.

**Components:**
- **`MileagePrompt`** — checks `localStorage` key `mileage_prompted_{vehicleId}_{YYYY-MM-DD}` on mount; shows dismissible mileage input if not seen today. `dismiss()` fires in mutation `onSuccess` (not before) to prevent silent data loss on mutation failure. Accepts `currentMileage: number` prop; submit is blocked and an inline error shown when entered value < `currentMileage`.
- **`MaintenanceCardRow`** — colour-coded row: red (`bg-destructive/10`) for overdue, yellow (`bg-yellow-50 dark:bg-yellow-950`) for warning; shows remaining mileage or "OVERDUE"; includes dark mode variants for yellow states
- **`VehicleDashboardPage`** — `AuthGuard` wrapper, vehicle header, mileage prompt, sort toggle, card list; redirects to `/` on 404/error

**App Router page:**
- `frontend/src/app/vehicles/[id]/page.tsx` — async RSC, awaits `params`, delegates to `VehicleDashboardPage`

### Key post-review fixes
- `MileagePrompt.handleSubmit`: `dismiss()` moved to `onSuccess` callback — prevents marking prompt as seen when mileage save fails
- `MaintenanceCardRow` warning colors: added `dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-400` variants
- `usePatchVehicle` comments clarified to explain `exact: true` on `invalidateQueries`
- `MileagePrompt` input validation: `disabled={!value.trim() || isNaN(parseFloat(value))}` — rejects whitespace-only and non-numeric input

### Key files
- `frontend/src/hooks/queries/vehicles/useVehicle.ts`
- `frontend/src/hooks/mutations/vehicles/usePatchVehicle.ts`
- `frontend/src/components/vehicles/mileage-prompt.tsx`
- `frontend/src/components/maintenance-cards/maintenance-card-row.tsx`
- `frontend/src/components/pages/vehicle-dashboard-page.tsx`
- `frontend/src/app/vehicles/[id]/page.tsx`

---

## Plan 13 — Firebase Runtime Environment Config

**Goal:** Replace compile-time Firebase env var substitution (baked into JS bundle at `next build`) with a Server Action that reads `process.env` at runtime, so Firebase config is never embedded in the client bundle.

**Problem:** When `next build` runs during Docker image build (before env vars are injected), Firebase config is undefined → Firebase fails to initialize in production.

### What was implemented

- **`frontend/src/actions/firebase-config.ts`** — `'use server'` Server Action (`getFirebaseConfig()`) that reads `process.env` at request time; config never baked into bundle
- **`frontend/src/lib/firebase.ts`** — Refactored from module-level singleton to lazy init API: `initFirebase(config)` + `getFirebaseAuth()`. `getFirebaseAuth()` throws if called before init.
- **`AuthProvider`** — Now calls `getFirebaseConfig()` on mount (async), then calls `initFirebase(config)`, then subscribes to `onAuthStateChanged`
- **`authError`** field added to `AuthContextValue` for surfacing init failures
- **`next.config.ts` `env` block removed** — no env vars leaked to client bundle

### Key design decisions

- **`settled` flag** in `AuthProvider` prevents stale state updates if component unmounts before config fetch completes
- **`authError` state** set when `getFirebaseConfig()` or `initFirebase()` throws — surfaces config failures to UI without crashing
- **`setAuthTokenGetter` reset on unmount** — safe because `api-client.ts` guards with `if (getToken)` before use

### Key post-implementation fixes
- Added missing `authError: null` to test mocks in `auth-guard.spec.tsx` and `login/page.spec.tsx`

### Key files
- `frontend/src/actions/firebase-config.ts` (new)
- `frontend/src/actions/firebase-config.spec.ts` (new)
- `frontend/src/lib/firebase.ts` (rewritten — lazy init API)
- `frontend/src/lib/firebase.spec.ts` (rewritten)
- `frontend/src/contexts/auth-context.tsx` (modified — added `authError`)
- `frontend/src/components/providers/auth-provider.tsx` (modified — async init via server action)
- `frontend/src/components/providers/auth-provider.spec.tsx` (modified)
- `frontend/next.config.ts` (modified — removed `env` block)

---

## Plan 14 — Maintenance Card CRUD Frontend

**Goal:** Full CRUD on maintenance cards from the vehicle dashboard. Users can create, edit, mark done, and delete maintenance cards without leaving the dashboard.

### What was implemented

**Mutation hooks** (`frontend/src/hooks/mutations/maintenance-cards/`):
- **`useCreateMaintenanceCard(vehicleId)`** — `POST /vehicles/:id/maintenance-cards`; invalidates `[MAINTENANCE_CARDS, vehicleId]` on success
- **`usePatchMaintenanceCard(vehicleId, cardId)`** — `PATCH .../maintenance-cards/:cardId`; invalidates `[MAINTENANCE_CARDS, vehicleId]`
- **`useDeleteMaintenanceCard(vehicleId)`** — `DELETE .../maintenance-cards/:cardId` (cardId passed as mutation variable); invalidates `[MAINTENANCE_CARDS, vehicleId]`
- **`useMarkDone(vehicleId, cardId)`** — `POST .../complete`; invalidates `[MAINTENANCE_CARDS, vehicleId]` (prefix match) + `[VEHICLES, vehicleId]` (exact — mark done may update vehicle mileage)

**Dialog components** (`frontend/src/components/maintenance-cards/`):
- **`MaintenanceCardFormDialog`** — single component for both create and edit modes (mode determined by whether a `card` prop is passed). Fields: Type (3-button toggle: Task/Part/Item, default=task), Name (required), Description (optional), Every km (conditional), Every months (conditional). Save disabled until name filled AND at least one interval positive.
- **`MarkDoneDialog`** — Accepts `currentMileage: number` prop. Fields: Done at mileage (shown+required when card has `intervalMileage`), Notes (optional). Done button is disabled until `doneAtMileage >= currentMileage`. On save: calls `useMarkDone`, closes on success.
- **`DeleteConfirmDialog`** — Body: `Delete "[card.name]"? This cannot be undone.` Buttons: Cancel (ghost), Delete (destructive).

**`MaintenanceCardRow` updates:**
- Added ⋮ button opening an inline dropdown with three items: Mark Done, Edit, Delete
- New props: `isDropdownOpen`, `onDropdownToggle`, `onEdit`, `onMarkDone`, `onDelete`

**`VehicleDashboardPage` updates:**
- All dialog/dropdown state lifted here (`editingCard`, `markingDoneCard`, `deletingCard`, `activeDropdownId`) — guarantees mutual exclusion with no coordination logic
- Passes down callbacks to `MaintenanceCardRow`; opens appropriate dialog on action

**Success toasts** (via sonner): "Card created", "Card updated", "Card deleted", "Marked as done"

### Key design decisions

- **State lifted to page level** — mutual exclusion of dialogs/dropdowns is a free side-effect of keeping state in one place; no need for explicit locking logic
- **Cache invalidation uses prefix match** for card lists — covers both sorted and unsorted cache entries for the same vehicle with a single invalidate call
- **`useMarkDone` invalidates both cards and vehicle** — mark-done may bump vehicle mileage; vehicle query would be stale otherwise

### Key files
- `frontend/src/hooks/mutations/maintenance-cards/useCreateMaintenanceCard.ts` (new)
- `frontend/src/hooks/mutations/maintenance-cards/usePatchMaintenanceCard.ts` (new)
- `frontend/src/hooks/mutations/maintenance-cards/useDeleteMaintenanceCard.ts` (new)
- `frontend/src/hooks/mutations/maintenance-cards/useMarkDone.ts` (new)
- `frontend/src/components/maintenance-cards/maintenance-card-form-dialog.tsx` (new)
- `frontend/src/components/maintenance-cards/mark-done-dialog.tsx` (new)
- `frontend/src/components/maintenance-cards/delete-confirm-dialog.tsx` (new)
- `frontend/src/components/maintenance-cards/maintenance-card-row.tsx` (modified)
- `frontend/src/components/pages/vehicle-dashboard-page.tsx` (modified)

---

## Plan 15 — Add Card Button Redesign

**Goal:** Replace the floating action button (FAB, fixed position bottom-right) with an inline dotted-border add-card box at the top of the maintenance cards section.

**Problem with FAB:** Fixed-position overlay obscures card content; not inline with the list it adds to.

### What was implemented

- FAB removed entirely from `VehicleDashboardPage`
- Full-width dotted-border button added above the cards list (always visible regardless of loading/empty state)
- `relative` class removed from `<main>` (was only needed as FAB positioning reference)

### Render structure

```tsx
<div className="flex flex-col gap-2">
  {/* Add card box — always visible */}
  <button
    type="button"
    aria-label="Add maintenance card"
    onClick={() => setCreateOpen(true)}
    className="flex w-full items-center justify-center rounded-md border-2 border-dashed border-gray-300 py-4 text-gray-400 hover:bg-gray-50"
  >
    <span className="text-2xl font-light leading-none">+</span>
  </button>

  {cardsLoading ? (
    <p>Loading cards…</p>
  ) : cards.length === 0 ? (
    <p>No maintenance cards yet.</p>
  ) : (
    cards.map((card) => <MaintenanceCardRow ... />)
  )}
</div>
```

### Key files
- `frontend/src/components/pages/vehicle-dashboard-page.tsx` (modified)
- `frontend/src/components/pages/vehicle-dashboard-page.spec.tsx` (modified)
