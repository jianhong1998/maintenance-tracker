# Feature Flags Design

**Date:** 2026-04-14
**Branch:** `chore/000/implement-new-ui-design`

## Overview

Add feature flags to gate the History and Profile nav tabs and their routes. Flags are controlled by the backend via env vars, exposed via a new `GET /feature-flag` endpoint, and consumed by the frontend to both hide nav items and redirect users who navigate directly to disabled routes.

---

## Backend

### Environment Variables

Two new env vars added to `.env` and `.env.template` (following the existing `BACKEND_ENABLE_` prefix convention):

```
BACKEND_ENABLE_HISTORY=false
BACKEND_ENABLE_PROFILE=false
```

Default: `false` (both features off until explicitly enabled).

### `EnvironmentVariableUtil` (`backend/src/modules/common/utils/environment-variable.util.ts`)

Extend `IFeatureFlagList` with two new fields:

```typescript
type IFeatureFlagList = {
  enableApiTestMode: boolean;
  enableHistory: boolean;   // reads BACKEND_ENABLE_HISTORY
  enableProfile: boolean;   // reads BACKEND_ENABLE_PROFILE
};
```

`getFeatureFlags()` reads `BACKEND_ENABLE_HISTORY` and `BACKEND_ENABLE_PROFILE` from `ConfigService`, defaulting to `'false'`, and coerces to boolean via `=== 'true'`.

### New Endpoint: `GET /feature-flag`

Added to the existing `ConfigController` (`backend/src/modules/config/config.controller.ts`):

- Decorated with `@Public()` — no auth required
- Injects `EnvironmentVariableUtil` (already provided by `CommonModule`)
- Returns `IFeatureFlagResDTO`

```typescript
@Public()
@Get('feature-flag') // resolves to GET /feature-flag
getFeatureFlag(): IFeatureFlagResDTO {
  const { enableHistory, enableProfile } =
    this.environmentVariableUtil.getFeatureFlags();
  return { enableHistory, enableProfile };
}
```

The existing `GET /config` endpoint is untouched.

---

## Shared Types (`packages/types`)

New file `src/dtos/feature-flag.dto.ts`:

```typescript
export interface IFeatureFlagResDTO {
  enableHistory: boolean;
  enableProfile: boolean;
}
```

Re-exported from `src/dtos/index.ts`.

---

## Frontend

### Query Key

Add `FEATURE_FLAG` to the `QueryGroup` const object in `src/hooks/queries/keys/key.ts`.

### New Hook: `useFeatureFlags`

File: `src/hooks/queries/feature-flag/useFeatureFlags.ts`

```typescript
export const useFeatureFlags = () => {
  return useQuery<IFeatureFlagResDTO>({
    queryKey: [QueryGroup.FEATURE_FLAG],
    queryFn: async () => apiClient.get<IFeatureFlagResDTO>('/feature-flag'),
    staleTime: Infinity,
  });
};
```

`staleTime: Infinity` — flags only change on redeploy, not at runtime.

### `AppShell` (`src/components/layout/app-shell.tsx`)

Calls `useFeatureFlags()` and passes `enableHistory` and `enableProfile` as props to `AppShellPresentation`. Falls back to `false` while the query is loading (nav items hidden until flags resolve).

### `AppShellPresentation` (`src/components/layout/app-shell-presentation.tsx`)

Receives two new props:

```typescript
type AppShellPresentationProps = {
  showNav: boolean;
  pathname: string;
  userDisplayName: string | null;
  enableHistory: boolean;
  enableProfile: boolean;
  children: ReactNode;
};
```

Filters `NAV_ITEMS` before rendering:

```typescript
const visibleNavItems = NAV_ITEMS.filter(({ href }) => {
  if (href === '/history') return enableHistory;
  if (href === '/profile') return enableProfile;
  return true;
});
```

Both the sidebar and the mobile bottom tab bar render `visibleNavItems` instead of `NAV_ITEMS`.

### `FeatureFlagGuard` (`src/components/auth/feature-flag-guard.tsx`)

New client component mirroring the existing `AuthGuard` pattern:

```typescript
type FeatureFlagGuardProps = {
  flagKey: keyof IFeatureFlagResDTO;
  children: ReactNode;
};
```

- Calls `useFeatureFlags()` internally and reads `data[flagKey]`
- While loading: renders `null`
- If the flag is `false`: calls `router.replace('/')`, renders `null`
- If the flag is `true`: renders `children`

### Route Gating

`src/app/history/page.tsx` and `src/app/profile/page.tsx` wrap their content with `FeatureFlagGuard`:

```tsx
// history/page.tsx
export default function HistoryPage() {
  return (
    <AuthGuard>
      <FeatureFlagGuard flagKey="enableHistory">
        <HistoryContent />
      </FeatureFlagGuard>
    </AuthGuard>
  );
}
```

`FeatureFlagGuard` accepts a `flagKey: keyof IFeatureFlagResDTO` prop, calls `useFeatureFlags()` internally, and reads the relevant boolean — pages stay decoupled from the flag fetch.

---

## Testing

### Backend
- `config.controller.spec.ts` — add cases for `GET /feature-flag`: returns correct booleans from env, defaults to `false` when env vars unset, is decorated with `@Public()`
- `environment-variable.util.spec.ts` (if it exists) — add cases for `enableHistory` and `enableProfile` flag parsing

### Frontend
- `useFeatureFlags.spec.ts` — standard TanStack Query hook test: correct query key, calls correct endpoint
- `app-shell-presentation.spec.tsx` — add cases: History hidden when `enableHistory=false`, Profile hidden when `enableProfile=false`, both visible when flags are `true`
- `feature-flag-guard.spec.tsx` — renders children when enabled, redirects when disabled, renders null while loading

---

## Data Flow Summary

```
.env (BACKEND_ENABLE_HISTORY, BACKEND_ENABLE_PROFILE)
  → EnvironmentVariableUtil.getFeatureFlags()
  → GET /feature-flag (public endpoint)
  → useFeatureFlags() [staleTime: Infinity, TanStack Query]
  → AppShell (passes flags as props)
  → AppShellPresentation (filters NAV_ITEMS)
  → FeatureFlagGuard (guards page content, redirects if disabled)
```
