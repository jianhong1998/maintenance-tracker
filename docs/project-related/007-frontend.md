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
- **`usePatchVehicle(vehicleId)`** — `PATCH /vehicles/:id`; on success: `invalidateQueries([VEHICLES, vehicleId], exact: true)` + `invalidateQueries([VEHICLES], exact: true)`. Does not use `setQueryData` — avoids the stale-closure bug where `vehicleId` is `''` on first render (see Bug 2 in `docs/bug-list/001-mileage-update-issues/`).

**Components:**
- **`MileagePrompt`** — checks `localStorage` key `mileage_prompted_{vehicleId}_{YYYY-MM-DD}` on mount; shows dismissible mileage input if not seen today. `dismiss()` fires in mutation `onSuccess` (not before) to prevent silent data loss on mutation failure. Accepts `currentMileage: number` prop; submit is blocked and an inline error shown when entered value < `currentMileage`.
- **`MaintenanceCardRow`** — colour-coded row: red (`bg-destructive/10`) for overdue, yellow (`bg-yellow-50 dark:bg-yellow-950`) for warning; shows remaining mileage or "OVERDUE"; includes dark mode variants for yellow states
- **`VehicleDashboardPage`** — `AuthGuard` wrapper, vehicle header, mileage prompt, sort toggle, card list; redirects to `/` on 404/error

**App Router page:**
- `frontend/src/app/vehicles/[id]/page.tsx` — async RSC, awaits `params`, delegates to `VehicleDashboardPage`

### Key post-review fixes
- `MileagePrompt.handleSubmit`: `dismiss()` moved to `onSuccess` callback — prevents marking prompt as seen when mileage save fails
- `MaintenanceCardRow` warning colors: added `dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-400` variants
- `usePatchVehicle` uses dual `invalidateQueries` (individual vehicle + list) instead of `setQueryData` — avoids stale-closure bug where `vehicleId` captured as `''` on first render writes to the wrong cache key
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

---

## Plan 16 — Dark Terminal UI Redesign

**Goal:** Full visual redesign from stock shadcn/ui white to a Dark Terminal aesthetic with Electric Cyan (`#00e5ff`) accent, mobile-first responsive layout, and progress-bar maintenance cards.

**Spec:** `docs/superpowers/specs/2026-04-14-ui-redesign-design.md`

**Scope:** Pure frontend styling — no backend changes, no new data fields.

### Design Philosophy

**Dark Terminal aesthetic.** Inspired by crypto trading dashboards and AI developer tools. The app is dark-only — no light mode, no `dark:` prefixes anywhere. `color-scheme: dark` on `<html>` ensures browser-native controls (scrollbars, autofill) match.

**Token-first styling.** All colors are declared as CSS custom properties in `globals.css` under `:root`, exposed to Tailwind via `@theme inline` bindings. Downstream components reference token classes (`bg-background`, `border-border-accent`, `text-primary`) rather than hardcoded hex literals. Direct hex literals are only acceptable for values that have no token equivalent.

**Mobile-first responsive layout.** Three breakpoints:
- Mobile `< 768px` (default): bottom tab bar navigation, single-column grid
- Tablet `768px – 1279px` (`md:`): 52px icon sidebar (hidden bottom bar), 2-column grid
- Desktop `≥ 1280px` (`xl:`): 140px full sidebar with labels, 3-column grid, split-pane vehicle detail

The `xl:` prefix (1280px) is used for desktop-only layouts — NOT the default `lg:` (1024px).

**Pointer-only hover.** Mobile Safari leaves a sticky hover state after a tap. A `@custom-variant hover-pointer` in `globals.css` wraps all hover styles in `@media (hover: hover) and (pointer: fine)`, so hover effects only fire on real pointer devices.

### What was implemented

**`globals.css`:**
- Full dark palette tokens (`--bg-base`, `--bg-surface`, `--bg-card`, `--primary`, `--danger`, `--warning`, etc.)
- `@theme inline` bindings exposing all tokens to Tailwind
- Typography utility classes in `@layer components`: `.text-page-title`, `.text-eyebrow`, `.text-eyebrow-primary`, `.text-card-title`, `.text-meta`, `.text-status-chip`
- `body { font-family: var(--font-mono) }` — Geist Mono globally
- `@custom-variant hover-pointer` — pointer-only hover suppression

**`Button` component (`button.tsx`):**
- New variants: `secondary-destructive` (red outline, used by Delete on Vehicle Detail), `dashed-ghost` (dashed cyan border, used by "+ ADD VEHICLE" and "+ ADD MAINTENANCE CARD")
- New size: `icon-xs` (16×16px, `rounded-[4px]`) — used by the ⋮ action button on maintenance cards
- All `dark:` prefixes removed

**New primitives:**
- **`VehicleStatusChip`** (`vehicle-status-chip.tsx`) — reusable chip: "ALL GOOD" (cyan) or "{N} OVERDUE" (red). Single source of truth used in `VehicleCard`, `VehicleListItem` (split pane), and any future surfaces.
- **`getVehicleMetaLine(vehicle)`** in `vehicle-display.ts` — formats the detail-page meta line: `"Colour · Mileage unit · Plate: XXX"`. Distinct from `getVehicleDisplayLabels` (card-list brevity).

**`AppShell` + `AppShellPresentation`:**
- New responsive shell wrapping all authenticated pages
- `NAV_ITEMS` array holds three peers: Fleet, History, Profile (no hardcoded special cases)
- Active-match: segment-boundary — `pathname === href || pathname.startsWith(`${href}/`)` — prevents `/history-foo` matching `/history`
- `aria-current="page"` on active links
- Safe-area insets: `pb-[env(safe-area-inset-bottom)]` on mobile tab bar, `viewport-fit=cover` in `Viewport` export

**Restyled pages/components:**
- Login page: 52px logo mark with radial-gradient glow (not `blur-2xl`), cyan CTA, 0.5rem terms text
- Home page: gradient header, alert pill with English pluralization (`"1 ITEM NEEDS ATTENTION"` vs `"N ITEMS NEED ATTENTION"`), `md:grid-cols-2 xl:grid-cols-3` vehicle grid
- Vehicle Card: single meta line `"colour · mileage unit"` (brand/model removed from card), `VehicleStatusChip`, pointer-only hover
- Vehicle Dashboard: functional `<Link href="/">` back nav labeled `← GO BACK` (`xl:hidden`), `getVehicleMetaLine` for header, `secondary-destructive` Delete button
- Mileage Prompt: dark input with `border-primary-dim`, focus ring `#00e5ff40`, eyebrow label
- Maintenance Card Row: progress bar with a single cycle-consumption formula, single top-right sub-label ("N unit past due" / "N unit left"), no status text below the bar, `icon-xs` ⋮ button
- Dialog shell: dark surface, mobile bottom sheet with drag-handle grabber, centered modal on `sm:` and up
- All form dialogs: dark inputs, eyebrow labels, correct button variants

**New layouts:**
- `VehiclesLayout` + `frontend/src/app/vehicles/layout.tsx` — desktop split pane: 220px vehicle list panel (`xl:flex`) using `VehicleStatusChip`, plus detail content

**Placeholder routes:**
- `/history` and `/profile` — "Coming soon" pages wrapped in `AuthGuard`

### Progress bar formula

Let `interval` = `card.intervalMileage` (native unit), `remaining` = `nextDueMileage - currentMileage` (native unit):

- **Render gate.** Bar is rendered only when `nextDueMileage !== null` **and** `intervalMileage !== null` **and** `intervalMileage > 0`. A card with no mileage interval has no well-defined cycle length — we hide the bar rather than fake one.
- **Fill.** `fill = clamp(1 - remaining / interval, 0, 1) × 100%`.
  - **Just-serviced** (`remaining = interval`) → 0%.
  - **Halfway** (`remaining = interval / 2`) → 50%.
  - **At due** (`remaining = 0`) → 100%.
  - **Overdue** (`remaining < 0`) → clamped to 100%.
  - **Stale / pre-cycle** (`remaining > interval`, e.g. after user lowers `intervalMileage` without recomputing `nextDueMileage`) → clamped to 0%. Accepted UX: the card appears "fresh" under the new shorter cycle because the system's implied last-done point sits at or past current mileage. The numeric sub-label still shows the true remaining distance.
- **Colour** tracks `mileageStatus` (cyan / amber / red) independently of fill. Width encodes "fraction of cycle consumed"; colour encodes "urgency tier". The two signals are independent and do not need to agree in appearance — e.g. a card 40% through a long cycle is still cyan because `remaining > threshold`.

### Prior formula (superseded 2026-04-18)

The old three-branch piecewise formula (overdue = 100%, warning = 60→99%, healthy = 0→59% across a `5 × threshold` lookahead) was dropped after user feedback that the bar felt confusing. Root cause: a discontinuity at the ok→warning boundary (bar jumped ~13% with no real change in mileage) and three magic numbers (60, 39, 59, 5×) with no derivation. The single cycle-consumption formula is monotonic, continuous, unit-safe, and needs no magic numbers.

### Healthy label color rule

- `ok` (`remaining > threshold`): color = `--primary` (`#00e5ff`) — cyan.

The earlier two-tier healthy rule (muted grey beyond `3 × threshold`, cyan inside) was dropped after user feedback: grey reads as "disabled" and obscured that the card was still being tracked. `--text-disabled` remains in use for type badges and the ⋮ action button.

### Key files

New:
- `frontend/src/app/globals.css` (rewritten)
- `frontend/src/components/ui/button.tsx` (rewritten)
- `frontend/src/components/vehicles/vehicle-status-chip.tsx`
- `frontend/src/components/layout/app-shell.tsx`
- `frontend/src/components/layout/app-shell-presentation.tsx`
- `frontend/src/components/layout/vehicles-layout.tsx`
- `frontend/src/app/vehicles/layout.tsx`
- `frontend/src/app/history/page.tsx`
- `frontend/src/app/profile/page.tsx`

Modified:
- `frontend/src/lib/vehicle-display.ts` (added `getVehicleMetaLine`)
- `frontend/src/app/layout.tsx` (added `AppShell`, `Viewport` with `viewportFit: 'cover'`)
- `frontend/src/app/login/page.tsx`
- `frontend/src/components/pages/home-page.tsx`
- `frontend/src/components/vehicles/vehicle-card.tsx`
- `frontend/src/components/pages/vehicle-dashboard-page.tsx`
- `frontend/src/components/vehicles/mileage-prompt-presentation.tsx`
- `frontend/src/components/maintenance-cards/maintenance-card-row.tsx`
- `frontend/src/components/ui/dialog.tsx`
- All form dialogs (vehicle-form-dialog-presentation, maintenance-card-form-dialog, mark-done-dialog, vehicle-delete-confirm-dialog, delete-confirm-dialog)
