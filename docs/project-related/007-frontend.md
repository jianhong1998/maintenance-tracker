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
- **`usePatchVehicle(vehicleId)`** — `PATCH /vehicles/:id`; on success: `setQueryData` for individual vehicle entry + `invalidateQueries` (exact: true) for list

**Components:**
- **`MileagePrompt`** — checks `localStorage` key `mileage_prompted_{vehicleId}_{YYYY-MM-DD}` on mount; shows dismissible mileage input if not seen today. `dismiss()` fires in mutation `onSuccess` (not before) to prevent silent data loss on mutation failure
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
