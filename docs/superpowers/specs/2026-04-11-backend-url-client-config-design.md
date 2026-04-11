# Design: Runtime Backend URL Configuration for Client Side

**Date:** 2026-04-11 (revised after code review)
**Branch:** config/000/pipeline-creation

---

## Problem

`FRONTEND_BACKEND_BASE_URL` is read via `process.env` in `src/constants/index.ts` and consumed by the axios instance in `src/lib/api-client.ts` at module initialization time. In the browser, Next.js does not expose `FRONTEND_*` variables — only `NEXT_PUBLIC_*` are inlined at build time. The project convention explicitly forbids `NEXT_PUBLIC_` prefixes (to preserve runtime flexibility). As a result, the client-side axios instance always falls back to `'http://localhost:3001'` regardless of what the env file says, causing incorrect API calls in any environment where the backend URL differs.

---

## Approach

`layout.tsx` is already a Server Component and can read `process.env.FRONTEND_BACKEND_BASE_URL` directly. The fix passes the URL as a prop to a thin `ConfigProvider` client component that calls `setBaseUrl()` synchronously during render — before any child mounts.

No server action, no `useEffect`, no loading gate, no async round-trip.

> **Why not mirror the `firebase-config.ts` pattern?** Firebase initialization is inherently async — the SDK must be initialised before auth state can be observed. A backend URL is a single string available at server render time. An async loading gate for static config introduces a blank-screen window on every page load and a hydration mismatch risk. The synchronous prop approach eliminates both.

---

## Provider Tree (after)

```
layout.tsx (Server Component — reads env var, passes as prop)
  └── ConfigProvider (client)  ← NEW — calls setBaseUrl synchronously
       └── ReactQueryProvider
            └── AuthProvider
                 └── page content
  └── Toaster
```

---

## Files

### Modified: `src/lib/api-client.ts`

- Remove `BACKEND_BASE_URL` import (no longer set at init time).
- Create axios instance without `baseURL`.
- Export `setBaseUrl()`.

```ts
// Remove:
import { BACKEND_BASE_URL } from '@/constants';

// Change axios.create — remove baseURL field:
const axiosInstance = axios.create({
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

// Add — mirrors existing setAuthTokenGetter pattern:
export function setBaseUrl(url: string): void {
  axiosInstance.defaults.baseURL = url;
}
```

### Modified: `src/constants/index.ts`

Remove `BACKEND_BASE_URL` — only imported by `api-client.ts`, becomes unused after this change. File reduces to:

```ts
export * from './error-message';
```

### New: `src/components/providers/config-provider.tsx`

Synchronous client component. Receives `backendUrl` as a prop from the server component layout. Calls `setBaseUrl` during render — before any child mounts.

```ts
'use client';

import { FC, ReactNode } from 'react';
import { setBaseUrl } from '@/lib/api-client';

type ConfigProviderProps = {
  backendUrl: string;
  children: ReactNode;
};

export const ConfigProvider: FC<ConfigProviderProps> = ({ backendUrl, children }) => {
  setBaseUrl(backendUrl);
  return <>{children}</>;
};
```

### Modified: `src/app/layout.tsx`

Read env var server-side, pass to `ConfigProvider` as prop.

```tsx
import { ConfigProvider } from '@/components/providers/config-provider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const backendUrl =
    process.env.FRONTEND_BACKEND_BASE_URL ?? 'http://localhost:3001';

  return (
    <html lang="en">
      <body>
        <ConfigProvider backendUrl={backendUrl}>
          <ReactQueryProvider>
            <AuthProvider>{children}</AuthProvider>
          </ReactQueryProvider>
        </ConfigProvider>
        <Toaster position="top-right" duration={5000} />
      </body>
    </html>
  );
}
```

---

## Data Flow

1. User visits page → Next.js server renders `layout.tsx`.
2. `layout.tsx` reads `process.env.FRONTEND_BACKEND_BASE_URL` correctly (server-side).
3. URL is passed as prop to `ConfigProvider` in the rendered HTML.
4. On client, `ConfigProvider` renders — calls `setBaseUrl(backendUrl)` synchronously before any child mounts.
5. Children render — `ReactQueryProvider`, `AuthProvider`, and all page components mount with the correct base URL already set.

Zero async, zero loading gate, zero blank-screen window.

---

## Verification

1. Set `FRONTEND_BACKEND_BASE_URL=http://localhost:3001` in the root `.env`.
2. Run `just up-build`.
3. Open browser DevTools → Network tab.
4. Verify API requests go to `http://localhost:3001/...` (not `localhost:3000`).
5. Run `just lint` and `just format` — no new errors.
