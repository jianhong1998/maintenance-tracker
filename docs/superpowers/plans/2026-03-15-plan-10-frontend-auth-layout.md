# Plan 10: Frontend Auth & Layout

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Firebase Google Sign-in into the Next.js frontend — Firebase SDK initialisation, `AuthProvider` with `onAuthStateChanged`, automatic `Authorization: Bearer` token injection on all API calls, an `AuthGuard` client component that redirects unauthenticated users to `/login`, and the `/login` page itself.

**Architecture:** A `firebase.ts` singleton initialises the Firebase app and exports `auth`. An `AuthContext` + `AuthProvider` subscribe to `onAuthStateChanged`, provide `user`/`loading`/`signInWithGoogle`/`signOut`, and wire a token getter into `api-client.ts` via `setAuthTokenGetter`. An `AuthGuard` client component checks the context and redirects to `/login` when unauthenticated. The root `layout.tsx` wraps the app with `AuthProvider`. The `/login` page calls `signInWithPopup` and redirects to `/` on success. No tests are needed — TypeScript compilation (`pnpm build`) is the verification gate for each task.

**Tech Stack:** Firebase JS SDK v10 (`firebase/app`, `firebase/auth`), Next.js 15 App Router, React context, `useRouter` / `useEffect`, existing `axios` interceptor API

**Spec reference:** `docs/superpowers/specs/2026-03-14-maintenance-tracker-design.md` — Section 2 (Auth flow), Section 6 (Frontend Structure: `/login` page)

**Prerequisites:** Plan 01 must be complete (monorepo running). No backend auth plans are prerequisites for this plan — the frontend attaches whatever token Firebase returns; the guard verifies it server-side.

---

## Chunk 1: Firebase Init, Auth Context, API Token Injection

### Task 1: Install Firebase and update `.env.template`

**Files:**
- Modify: `frontend/package.json` (via pnpm add)
- Modify: `frontend/.env` and root `.env.template`

- [ ] **Step 1: Install Firebase SDK**

```bash
cd frontend && pnpm add firebase
```

Expected: `"firebase"` appears in `frontend/package.json` dependencies.

- [ ] **Step 2: Add Firebase public env vars to `frontend/.env`**

Add the following to `frontend/.env` (create if it doesn't exist):

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
```

- [ ] **Step 3: Add Firebase vars to root `.env.template`**

Append to `.env.template`:

```dotenv
# Firebase (frontend)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
```

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml .env.template
git commit -m "chore: install Firebase SDK and add frontend env vars to template"
```

---

### Task 2: Create `src/lib/firebase.ts`

**Files:**
- Create: `frontend/src/lib/firebase.ts`

- [ ] **Step 1: Create `firebase.ts`**

Create `frontend/src/lib/firebase.ts`:

```typescript
import { getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
```

`getApps().length === 0` guard prevents "Firebase App named '[DEFAULT]' already exists" errors during Next.js hot-reloads.

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
git add frontend/src/lib/firebase.ts
git commit -m "feat: initialise Firebase app and auth singleton"
```

---

### Task 3: Create `AuthContext` and `AuthProvider`

**Files:**
- Create: `frontend/src/contexts/auth-context.tsx`
- Create: `frontend/src/components/providers/auth-provider.tsx`

- [ ] **Step 1: Create `auth-context.tsx`**

Create `frontend/src/contexts/auth-context.tsx`:

```typescript
import { createContext, useContext } from 'react';
import type { User } from 'firebase/auth';

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return ctx;
}
```

- [ ] **Step 2: Create `auth-provider.tsx`**

Create `frontend/src/components/providers/auth-provider.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import {
  type User,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { AuthContext } from '@/contexts/auth-context';
import { setAuthTokenGetter } from '@/lib/api-client';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wire up the token getter so apiClient can attach Bearer tokens
    setAuthTokenGetter(async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return null;
      return await currentUser.getIdToken();
    });

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
```

- [ ] **Step 3: Build to verify types compile**

```bash
cd frontend && pnpm build
```

Expected: No TypeScript errors.

- [ ] **Step 4: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/contexts/auth-context.tsx \
        frontend/src/components/providers/auth-provider.tsx
git commit -m "feat: add AuthContext and AuthProvider with Firebase onAuthStateChanged"
```

---

### Task 4: Update `api-client.ts` to attach Bearer token

**Files:**
- Modify: `frontend/src/lib/api-client.ts`

Add a module-level `getToken` variable and `setAuthTokenGetter` export, then attach a request interceptor that calls `getToken()` before every request.

- [ ] **Step 1: Update `api-client.ts`**

Replace the contents of `frontend/src/lib/api-client.ts` with:

```typescript
import { BACKEND_BASE_URL } from '@/constants';
import axios from 'axios';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let getToken: (() => Promise<string | null>) | null = null;

/**
 * Called by AuthProvider to wire up Firebase ID token retrieval.
 * The interceptor calls this before every request so tokens are always fresh.
 */
export function setAuthTokenGetter(fn: () => Promise<string | null>): void {
  getToken = fn;
}

const axiosInstance = axios.create({
  baseURL: BACKEND_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

axiosInstance.interceptors.request.use(async (config) => {
  if (getToken) {
    const token = await getToken();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return config;
});

export const apiClient = {
  get: async <T>(endpoint: string): Promise<T> => {
    const response = await axiosInstance.get<T>(endpoint);
    return response.data;
  },

  post: async <T>(endpoint: string, data?: unknown): Promise<T> => {
    const response = await axiosInstance.post<T>(endpoint, data);
    return response.data;
  },

  put: async <T>(endpoint: string, data?: unknown): Promise<T> => {
    const response = await axiosInstance.put<T>(endpoint, data);
    return response.data;
  },

  patch: async <T>(endpoint: string, data?: unknown): Promise<T> => {
    const response = await axiosInstance.patch<T>(endpoint, data);
    return response.data;
  },

  delete: async <T>(endpoint: string): Promise<T> => {
    const response = await axiosInstance.delete<T>(endpoint);
    return response.data;
  },
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
git add frontend/src/lib/api-client.ts
git commit -m "feat: add Bearer token interceptor to apiClient via setAuthTokenGetter"
```

---

## Chunk 2: AuthGuard, Login Page, Root Layout

### Task 5: Create `AuthGuard` component

**Files:**
- Create: `frontend/src/components/auth/auth-guard.tsx`

`AuthGuard` is a client component. When auth is loading it shows a spinner; when the user is not authenticated it redirects to `/login`; when authenticated it renders children.

- [ ] **Step 1: Create `auth-guard.tsx`**

Create `frontend/src/components/auth/auth-guard.tsx`:

```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/contexts/auth-context';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  if (!user) {
    // Redirect is in progress; render nothing to avoid flash
    return null;
  }

  return <>{children}</>;
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
git add frontend/src/components/auth/auth-guard.tsx
git commit -m "feat: add AuthGuard client component with redirect to /login"
```

---

### Task 6: Create `/login` page

**Files:**
- Create: `frontend/src/app/login/page.tsx`

The login page redirects authenticated users to `/` and shows a "Sign in with Google" button for unauthenticated users.

- [ ] **Step 1: Create `login/page.tsx`**

Create `frontend/src/app/login/page.tsx`:

```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <h1 className="text-2xl font-bold">Maintenance Tracker</h1>
        <p className="text-muted-foreground text-sm">
          Track your vehicle maintenance schedules
        </p>
        <Button onClick={() => void signInWithGoogle()} disabled={loading}>
          Sign in with Google
        </Button>
      </div>
    </main>
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
git add frontend/src/app/login/page.tsx
git commit -m "feat: add /login page with Google sign-in button"
```

---

### Task 7: Update root `layout.tsx` and apply `AuthGuard` to home page

**Files:**
- Modify: `frontend/src/app/layout.tsx`
- Modify: `frontend/src/components/pages/home-page.tsx`

The root layout gains `AuthProvider`. The existing `HomePage` component is wrapped with `AuthGuard`.

- [ ] **Step 1: Update `layout.tsx` to wrap with `AuthProvider`**

Replace the contents of `frontend/src/app/layout.tsx` with:

```typescript
import type { Metadata } from 'next';
import { Toaster } from 'sonner';
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
  return (
    <html lang="en">
      <body>
        <ReactQueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </ReactQueryProvider>
        <Toaster position="top-right" duration={5000} />
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Wrap `HomePage` with `AuthGuard`**

Replace the contents of `frontend/src/components/pages/home-page.tsx` with:

```typescript
'use client';

import { AuthGuard } from '@/components/auth/auth-guard';

export function HomePage() {
  return (
    <AuthGuard>
      <main className="p-6">
        <h1 className="text-xl font-semibold">Home</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your vehicles will appear here.
        </p>
      </main>
    </AuthGuard>
  );
}
```

The full home page content is implemented in Plan 11. This stub verifies the auth gate works end-to-end.

- [ ] **Step 3: Build to verify types compile**

```bash
cd frontend && pnpm build
```

Expected: No TypeScript errors.

- [ ] **Step 4: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [ ] **Step 5: Smoke test**

```bash
just up-build
```

Open `http://localhost:3000`. Expected:
- Unauthenticated: redirected to `/login`, Google Sign-in button visible.
- After signing in: redirected to `/`, "Your vehicles will appear here." text visible.
- After signing out (via browser console `auth.signOut()`): redirected back to `/login`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/layout.tsx \
        frontend/src/components/pages/home-page.tsx
git commit -m "feat: wrap root layout with AuthProvider and protect home page with AuthGuard"
```

---

## Post-implementation Code Review Notes

Reviewed after implementation on 2026-03-24. Summary of findings and resolutions.

### ✅ Fixed: Missing error handling in `signInWithGoogle` (login page)

**Issue:** `signInWithGoogle()` was called with `void` and no try/catch. If the popup is blocked, the user cancels, or a network error occurs, the rejection was silently swallowed — the button would do nothing with no feedback.

**Fix applied:** Wrapped in `handleSignIn` with try/catch; added `signInError` state; rendered error message below the button (`text-destructive text-sm`). Committed in `feat: 010 - add error handling for signInWithGoogle on login page`.

---

### ❌ Invalid: Context/provider split (`auth-context.tsx` vs `auth-provider.tsx`)

**Raised as:** Unnecessary indirection — one concept split into two files.

**Why invalid:** `auth-context.tsx` exports `useAuthContext` which is imported by two independent consumers (`auth-guard.tsx` and `login/page.tsx`). Both need the hook but neither should import from a "provider" file. The split is the correct boundary: context shape + hook in one file, provider implementation in another. This is an intentional, idiomatic React pattern.

---

### ❌ Invalid: `AuthGuard` double-check for unauthenticated state

**Raised as:** `useEffect` redirect and `return null` both check `!user`, appearing redundant.

**Why invalid:** They serve orthogonal roles. The `useEffect` triggers the imperative router navigation (async side effect). The `return null` suppresses content flash during the React render cycle while the navigation processes. Removing either breaks the UX. Not redundant — two mechanisms for two concerns.

---

### ❌ Invalid: Mutable global state for token getter (`setAuthTokenGetter`)

**Raised as:** Module-level `let getToken` mutated at runtime is implicit coupling.

**Why invalid:** This is the intentional design. The interceptor must call `getToken()` lazily at request time to get a fresh Firebase token — it cannot capture the token at setup time. The module-level variable is the correct mechanism. Single provider, single lifecycle, no ambiguity. Acceptable for this scope.

---

### ❌ Invalid for this plan: `AuthGuard` at component level vs. protected layout

**Raised as:** Per-component `AuthGuard` wrapping is error-prone at scale — a developer can forget to add it.

**Why deferred:** This plan explicitly describes `HomePage` as a stub ("full home page content is implemented in Plan 11"). The component-level guard is scaffolding to verify the auth gate end-to-end. Plan 11 should introduce a `(protected)` route group with a shared layout that applies `AuthGuard` once, replacing the per-component pattern.

**Action for Plan 11:** Adopt `app/(protected)/layout.tsx` wrapping `AuthGuard`. Remove `AuthGuard` from individual page components.
