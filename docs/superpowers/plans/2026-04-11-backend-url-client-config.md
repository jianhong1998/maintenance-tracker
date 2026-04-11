# Backend URL Client Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `FRONTEND_BACKEND_BASE_URL` available to the client-side axios instance by reading it in `layout.tsx` (a Server Component) and passing it synchronously to a thin `ConfigProvider` client wrapper.

**Architecture:** `layout.tsx` reads `process.env.FRONTEND_BACKEND_BASE_URL` server-side and passes it as a prop to `ConfigProvider`. `ConfigProvider` calls `setBaseUrl()` (new export on `api-client`) synchronously during render — before any child mounts. No server action, no `useEffect`, no loading gate, no async round-trip. The existing `BACKEND_BASE_URL` constant is removed.

**Tech Stack:** Next.js 15 App Router, React, Axios, Vitest + React Testing Library

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/api-client.ts` | Modify | Add `setBaseUrl()`, remove `BACKEND_BASE_URL` from init |
| `src/constants/index.ts` | Modify | Remove now-unused `BACKEND_BASE_URL` export |
| `src/components/providers/config-provider.tsx` | Create | Synchronous wrapper — receives `backendUrl` prop, calls `setBaseUrl` |
| `src/components/providers/config-provider.spec.tsx` | Create | Tests for `ConfigProvider` |
| `src/app/layout.tsx` | Modify | Read env var, pass as prop to `ConfigProvider` |

---

## Task 1: Add `setBaseUrl` to `api-client` and Remove `BACKEND_BASE_URL`

**Files:**
- Modify: `frontend/src/lib/api-client.ts`
- Modify: `frontend/src/constants/index.ts`

- [x] **Step 1: Modify `api-client.ts`**

In `frontend/src/lib/api-client.ts`:

**Remove** line 1 (the `BACKEND_BASE_URL` import):
```ts
import { BACKEND_BASE_URL } from '@/constants';
```

**Change** `axios.create(...)` — remove the `baseURL` field so the full call reads:
```ts
const axiosInstance = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});
```

**Add** `setBaseUrl` immediately after the `axiosInstance` declaration (before the interceptors block):
```ts
export function setBaseUrl(url: string): void {
  axiosInstance.defaults.baseURL = url;
}
```

- [x] **Step 2: Remove `BACKEND_BASE_URL` from `constants/index.ts`**

In `frontend/src/constants/index.ts`, remove the `BACKEND_BASE_URL` export. The file should contain only:

```ts
export * from './error-message';
```

- [x] **Step 3: Run lint to verify nothing else imports `BACKEND_BASE_URL`**

```bash
just lint
```

Expected: no errors. If any file still imports `BACKEND_BASE_URL`, fix it before continuing.

- [x] **Step 4: Commit**

```bash
git add frontend/src/lib/api-client.ts frontend/src/constants/index.ts
git commit -m "add setBaseUrl to api-client, remove BACKEND_BASE_URL constant"
```

---

## Task 2: Create `ConfigProvider`

**Files:**
- Create: `frontend/src/components/providers/config-provider.tsx`
- Create: `frontend/src/components/providers/config-provider.spec.tsx`

- [x] **Step 1: Write the failing tests**

Create `frontend/src/components/providers/config-provider.spec.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/api-client', () => ({
  setBaseUrl: vi.fn(),
}));

import { setBaseUrl } from '@/lib/api-client';
import { ConfigProvider } from './config-provider';

describe('ConfigProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls setBaseUrl with the backendUrl prop', () => {
    render(
      <ConfigProvider backendUrl="http://my-backend:4000">
        <div>child content</div>
      </ConfigProvider>,
    );
    expect(setBaseUrl).toHaveBeenCalledWith('http://my-backend:4000');
    expect(setBaseUrl).toHaveBeenCalledTimes(1);
  });

  it('renders children', () => {
    render(
      <ConfigProvider backendUrl="http://localhost:3001">
        <div>child content</div>
      </ConfigProvider>,
    );
    expect(screen.getByText('child content')).toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
cd frontend && pnpm exec vitest run src/components/providers/config-provider.spec.tsx
```

Expected: FAIL — `Cannot find module './config-provider'`

- [x] **Step 3: Implement `config-provider.tsx`**

Create `frontend/src/components/providers/config-provider.tsx`:

```tsx
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

- [x] **Step 4: Run test to verify it passes**

```bash
cd frontend && pnpm exec vitest run src/components/providers/config-provider.spec.tsx
```

Expected: PASS — 2 tests pass

- [x] **Step 5: Commit**

```bash
git add frontend/src/components/providers/config-provider.tsx frontend/src/components/providers/config-provider.spec.tsx
git commit -m "add synchronous ConfigProvider to set backend base URL before children mount"
```

---

## Task 3: Wire `ConfigProvider` into `layout.tsx` and Verify

**Files:**
- Modify: `frontend/src/app/layout.tsx`

- [x] **Step 1: Update `layout.tsx`**

Replace the entire contents of `frontend/src/app/layout.tsx` with:

```tsx
import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { ConfigProvider } from '@/components/providers/config-provider';
import { ReactQueryProvider } from '@/components/providers/react-query-provider';
import { AuthProvider } from '@/components/providers/auth-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Maintenance Tracker',
  description: 'Track your vehicle maintenance schedules',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
        <Toaster
          position="top-right"
          duration={5000}
        />
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Run the full frontend check**

```bash
just check-implementation-frontend
```

Expected: format passes, lint passes, build passes, all tests pass

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/layout.tsx
git commit -m "wire ConfigProvider into root layout, pass backend URL from server component"
```

---

## Verification

After completing all tasks:

1. Ensure `FRONTEND_BACKEND_BASE_URL=http://localhost:3001` is set in the root `.env`.
2. Run `just up-build`.
3. Open browser DevTools → Network tab.
4. Navigate to the app — verify all API requests go to `http://localhost:3001/...`.
