# Naming Conventions

## Environment Variables

- All environment variables are stored in 1 `.env` file at the project root folder @../../ .
- All frontend environment variables should have prefix `FRONTEND_`.
- Never using `NEXT_` prefix for environment variable. Because NextJS will fix the value at build time. All the environment variable in this project must have the flexibility at runtime.
- **`FRONTEND_` variables are only accessible in Server Components and server-side code.** In Client Components (`'use client'`), `process.env.FRONTEND_*` returns `undefined` at runtime — Next.js does not inline non-`NEXT_PUBLIC_` variables into the client bundle. Access these variables only in server-side code (Server Components, API routes, server actions, or `src/constants/index.ts` which is used server-side).
- **Server Components reading `FRONTEND_*` env vars must be in dynamically-rendered routes.** Next.js 15 is "static by default" — if a Server Component has no dynamic functions (`cookies()`, `headers()`, etc.), Next.js pre-renders it at `next build` time, where all `FRONTEND_*` vars are `undefined`. The pre-rendered HTML is then served as-is at runtime, ignoring the container's env vars. The root layout (`src/app/layout.tsx`) addresses this with `export const dynamic = 'force-dynamic'`, which forces server-side rendering on every request. Do not remove this export.

# Component Convention

## Single responsibility

- Each file should only contain a component.
- Each component should only handle 1 responsibility. Eg:
  - `VehicleDisplay` component should only handle processing data and declare data processing functions. For example, consolidate data from the query and pass to `VehicleDisplayPresentation` for displaying on UI.
  - `VehicleDisplayPresentation` component should only handle UI rendering for the data passed in.
- Benefit of doing this is to make the components be easier to manage
- **Container components that use React hooks (TanStack Query, `useState`, etc.) must have `'use client'` at the top of the file.** In Next.js App Router, all components are Server Components by default — hooks only work in Client Components.

### Example

```typescript
// vehicle-display.tsx
'use client';

import { FC } from 'react';

// all path are just for example, not the actual location
import { useGetVehicle } from 'hooks/queries/';
import { VehicleDisplayPresentation } from './vehicle-display-presentation';

type VehicleDisplayProps = {
  vehicleId: string;
  // other props
};

export const VehicleDisplay: FC<VehicleDisplayProps> = ({
  vehicleId,
  // other props
}) => {
  // Getting data from query
  const { data: vehicle } = useGetVehicle({
    vehicleId,
  });
  const { mutation: deleteVehicleFn } = useDeleteVehicle();

  // Example of processing data
  const displayedVehicleId = vehicle.id ?? '';

  // Example of function declaring for processing data
  const deleteVehicle = (vehicleId: string) => {
    deleteVehicleFn(vehicleId)
  }

  return <VehicleDisplayPresentation vehicle={vehicle} vehicleId={displayedVehicleId} onDeleteVehicle={deleteVehicle} />;
};
```

```typescript
// vehicle-display-presentation.tsx

import { FC } from 'react';

// all path are just for example, not the actual location
import { IVehicleData } from 'types/vehicle-data.type';

type VehicleDisplayPresentationProps = {
  vehicle: IVehicleData;
  displayedVehicleId: string;
  onDeleteVehicle: (vehicleId: string) => void
  // other props
};

export const VehicleDisplayPresentation: FC<
  VehicleDisplayPresentationProps
> = ({ vehicle, displayedVehicleId, onDeleteVehicle }) => {
  return (
    <>
      <div>
        {displayedVehicleId}
      </div>
      <div>
        {vehicle.model}
      </div>
      <button onClick={onDeleteVehicle}>Delete</button>
      {/* Other JSX code */}
    </>
  )
};
```

## Syntax Convention

### Arrow Function

Avoid declaring function with keyword `function`, declaring as `arrow function` instead.
Only use keyword `function` when really required to hoist at the global.

**Exception: App Router page and layout components** (`page.tsx`, `layout.tsx`, `loading.tsx`, etc.) must use `export default function` syntax. These often need to be `async` for server-side data fetching, and Next.js documentation uses named `function` declarations for these files. This also produces cleaner stack traces.

```typescript
// Never do this (for regular functions)
function myFunction(name: string) {
  // function code
}

// Do this (for regular functions)
const myFunction = (name: string) => {
  // function code
};

// For App Router page/layout files — use named function declaration
export default async function VehiclePage({ params }: Props) {
  // page code
}
```

### Make use of `FC` type

For making maintenance easier, use `FC` (from react) when creating components defined as arrow functions.

**Note:** `FC` applies to components defined with arrow function syntax. Do **not** use `FC` for App Router page/layout components — those use `export default function` declarations (see [Arrow Function](#arrow-function) above).

```typescript
type VehicleDisplayProps = {
  vehicleId: string;
  // other props
};

// Never do this
const VehicleDisplay = ({ vehicleId }: VehicleDisplayProps) => {
  // Component code
};

// Do this instead (for arrow function components)
const VehicleDisplay: FC<VehicleDisplayProps> = ({ vehicleId }) => {
  // Component code
};
```

### `page.tsx` responsibility

`page.tsx` must only contain logic of the routing / redirecting. The rendering and action logic should be defined in page components in @./frontend/src/components/ .

Example of `page.tsx`:

> **Note:** In Next.js App Router, `page.tsx` files are **Server Components by default**. They cannot use React hooks (`useState`, `useEffect`, `useUser`, etc.) unless they have a `'use client'` directive at the top. Auth checks in server components should use `redirect()` from `next/navigation` and server-side session/cookie utilities — no client JavaScript required.

```ts
// Server Component page (recommended) — no 'use client' needed
import { redirect } from 'next/navigation';
import { VehiclePage as VehiclePageComponent } from '@/components/pages/vehicle-page';
import { getServerSession } from '@/lib/auth'; // example server-side auth utility

export default async function VehiclePage() {
  const session = await getServerSession();

  // if user is not logged in, redirect to auth page
  if (!session) {
    redirect('/login');
  }

  return <VehiclePageComponent />;
}
```

# Data refetch convention

## Always use `invalidateQueries` after mutations — never `setQueryData`

After a mutation succeeds, invalidate the relevant query keys. Do **not** write the mutation response directly into the cache via `queryClient.setQueryData`.

**Why:** Mutation hooks are often called with props that are undefined on first render (e.g. `usePatchVehicle(vehicle?.id ?? '')`). React's Rules of Hooks require the call to be unconditional, so the hook initialises with `vehicleId = ''`. If `onSuccess` closes over that `vehicleId` and writes `setQueryData([VEHICLES, vehicleId], response)`, it writes to the wrong cache key `[VEHICLES, '']`. The real query `[VEHICLES, realId]` is then invalidated and refetches from scratch — causing the component to briefly lose all data during the loading window (Bug 2).

**Rule:** After a mutation, invalidate all affected query keys with `exact: true`:

```ts
// ✅ Correct
onSuccess: () => {
  void queryClient.invalidateQueries({
    queryKey: [QueryGroup.VEHICLES, vehicleId],
    exact: true,
  });
  void queryClient.invalidateQueries({
    queryKey: [QueryGroup.VEHICLES],
    exact: true,
  });
},

// ❌ Never do this — stale-closure on vehicleId corrupts the cache
onSuccess: (updatedVehicle) => {
  queryClient.setQueryData([QueryGroup.VEHICLES, vehicleId], updatedVehicle);
  void queryClient.invalidateQueries({ queryKey: [QueryGroup.VEHICLES], exact: true });
},
```

Use `exact: true` on every `invalidateQueries` call to prevent unintended cascade to unrelated query keys.

---

# UI / Styling Conventions

## Dark-only theme

The app is dark-only. There is no light mode and no `.dark` class toggle. Consequences:

- **Never add `dark:` prefixes** to class names. All styles are written for dark backgrounds directly.
- `color-scheme: dark` is set on `<html>` so browser-native controls (scrollbars, autofill) match the theme.

## Design tokens — always prefer tokens over hex literals

All palette values are declared as CSS custom properties in `frontend/src/app/globals.css` under `:root` and exposed to Tailwind via `@theme inline`. Downstream components must use token-based Tailwind classes rather than hardcoded hex values where a token exists.

| Token class | Value | Usage |
|---|---|---|
| `bg-background` | `#07090f` | Page background |
| `bg-[color:var(--bg-surface)]` | `#0d1117` | Sidebar, popover surfaces |
| `bg-[color:var(--bg-card)]` | `#0f1923` | Cards, inputs, secondary buttons |
| `text-primary` / `border-primary` | `#00e5ff` | Primary interactive (cyan) |
| `border-primary-dim` | `#00e5ff20` | Subtle accent borders, input borders |
| `text-destructive` | `#ff4444` | Overdue status, destructive actions |
| `text-[color:var(--text-secondary)]` | `#888888` | Labels, meta text, type badges, ⋮ action button |
| `text-[color:var(--text-muted)]` | `#444444` | Inactive items, placeholders |
| `text-[color:var(--text-disabled)]` | `#555555` | Reserved — currently unused after type badges and ⋮ were bumped to `--text-secondary` for legibility |

Direct hex literals (e.g. `bg-[#ff44440d]`) are acceptable only for values that have no named token — for example, semi-transparent overlays that are one-off.

## Typography utility classes

These classes are defined in `@layer components` of `globals.css`. Use them instead of inlining the same font-size/tracking/color combinations:

| Class | Role |
|---|---|
| `.text-page-title` | `text-xl font-extrabold text-white` — page headings |
| `.text-eyebrow` | `0.6rem`, `0.15em` letter-spacing, uppercase, `--text-secondary` — section labels |
| `.text-eyebrow-primary` | Same as eyebrow but color `--primary` (cyan) — mileage prompt label |
| `.text-card-title` | `0.6875rem`, `font-weight: 700`, `--text-primary` — card name |
| `.text-meta` | `0.625rem`, `--text-secondary` — sub-labels, meta lines |
| `.text-status-chip` | `0.5rem`, `font-weight: 700`, uppercase — chip text |

Never inline `text-[0.6rem] tracking-[0.15em] uppercase` when `.text-eyebrow` already encodes it.

## Responsive layout breakpoints

| Name | Tailwind prefix | Width |
|---|---|---|
| Mobile (default) | _(none)_ | `< 768px` |
| Tablet | `md:` | `768px – 1279px` |
| Desktop | `xl:` | `≥ 1280px` |

**Use `xl:` for desktop-only layout.** The default `lg:` (1024px) is not used for structural layout decisions. Features that are desktop-only (full sidebar, split-pane vehicle detail, 3-column grid) gate on `xl:`.

## Pointer-only hover

Touch devices (mobile Safari) leave a sticky hover state after a tap. Never apply hover background/color changes with plain `hover:` on interactive cards or rows. Use the `hover-pointer:` custom variant instead:

```tsx
// ❌ Triggers on tap on mobile
className="hover:bg-[#111d2b]"

// ✅ Only triggers on real pointer devices
className="hover-pointer:bg-[#111d2b]"
```

The variant is declared once in `globals.css`:
```css
@custom-variant hover-pointer (&:where(@media (hover: hover) and (pointer: fine)):hover);
```

## Button variants

| Variant | Usage |
|---|---|
| `default` | Primary CTA — cyan background, dark text, `font-extrabold` |
| `secondary` | Secondary action — dark card background, `#333` border |
| `secondary-destructive` | Destructive action that isn't a full confirm (Delete button on Vehicle Detail header) |
| `dashed-ghost` | Add-entity actions — dashed cyan border, transparent background (`+ ADD VEHICLE`, `+ ADD MAINTENANCE CARD`) |
| `destructive` | Confirm-delete dialogs |
| `ghost` | Low-emphasis (Dismiss on mileage prompt) |

`size="icon-xs"` (16×16px) is used for the ⋮ action button on maintenance card rows.

## AppShell navigation

`AppShellPresentation` owns all three nav tabs (Fleet, History, Profile) in a single `NAV_ITEMS` array. Never add a hardcoded Profile link outside this array. Active-state uses segment-boundary matching:

```typescript
const isActive = (pathname: string, href: string): boolean => {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
};
```

This prevents `/history-foo` from matching `/history`.

## Safe-area insets (iOS)

The root layout exports `viewportFit: 'cover'` in the `Viewport` object, which enables `env(safe-area-inset-*)` on iOS. Components that sit at the bottom of the screen must account for the home indicator:

- Bottom tab bar: `pb-[env(safe-area-inset-bottom)]`
- Page content wrapper (mobile): `pb-[calc(3rem+env(safe-area-inset-bottom))]`
- Mobile dialog bottom sheets: `pb-[calc(1.25rem+env(safe-area-inset-bottom))]`

Do not remove `viewportFit: 'cover'` from `layout.tsx` — the safe-area padding only works when this is set.
