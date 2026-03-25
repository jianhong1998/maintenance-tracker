# Firebase Runtime Environment Variables Design

**Date:** 2026-03-25
**Branch:** feat/012/implementing-vehicle-dashboard
**Status:** Approved

## Problem

Firebase client config (`FRONTEND_FIREBASE_API_KEY`, `FRONTEND_FIREBASE_AUTH_DOMAIN`, `FRONTEND_FIREBASE_PROJECT_ID`) is currently read via `process.env` in client-side code. Next.js performs compile-time string substitution for these references, meaning the values are baked into the JavaScript bundle at `next build` time.

In the current Docker setup, `next dev` runs at container startup (after Docker Compose injects env vars), so it works locally. In production, where `next build` runs during image build, the env vars are not yet present — the bundle gets `undefined` values and Firebase fails to initialize.

## Goal

Read Firebase config at **runtime** (when the page is requested), not at compile time. Values must never be baked into the bundle.

## Approach: Server Action

A Next.js Server Action reads `process.env` on the server at call time (true runtime). `AuthProvider` calls it on mount, receives the config, and initializes Firebase lazily. Firebase is no longer a module-level singleton.

## Architecture

```
Browser loads page
  → AuthProvider mounts
      → calls getFirebaseConfig() server action  [POST to server, reads process.env]
      → receives { apiKey, authDomain, projectId }
      → calls initFirebase(config)               [initializes Firebase app + auth once]
      → sets up onAuthStateChanged
      → auth is ready, loading = false
```

## Files Changed

| File | Change |
|---|---|
| `src/actions/firebase-config.ts` | New file. Establishes `src/actions/` as the Server Actions directory convention. |
| `src/lib/firebase.ts` | Refactor — remove sync singleton, expose `initFirebase(config)` + `getFirebaseAuth()` |
| `src/contexts/auth-context.tsx` | Add `authError: Error \| null` to `AuthContextValue` |
| `src/components/providers/auth-provider.tsx` | Fetch config on mount, init Firebase, then subscribe to auth state |
| `frontend/next.config.ts` | Remove the `env` block entirely |

## Component Designs

### 1. `src/actions/firebase-config.ts` (new)

This file establishes the `src/actions/` directory as the convention for Next.js Server Actions in this project.

```ts
'use server';

export async function getFirebaseConfig() {
  return {
    apiKey: process.env.FRONTEND_FIREBASE_API_KEY,
    authDomain: process.env.FRONTEND_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FRONTEND_FIREBASE_PROJECT_ID,
  };
}
```

- Marked `'use server'` — executes on the server only, never bundled into client JS
- Returns config shape compatible with Firebase `initializeApp`
- If env vars are missing, the value is `undefined`; `initFirebase` validates before calling `initializeApp`

### 2. `src/lib/firebase.ts` (refactor)

```ts
import { getApps, initializeApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

let _auth: Auth | null = null;

export function initFirebase(config: {
  apiKey: string | undefined;
  authDomain: string | undefined;
  projectId: string | undefined;
}): Auth {
  if (_auth) return _auth;

  const missing = Object.entries(config)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    throw new Error(`Missing required Firebase config: ${missing.join(', ')}`);
  }

  // getApps()[0] reuses an existing app (e.g. across HMR cycles in dev).
  // This is intentional — we always own the first Firebase app in this project.
  const app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
  _auth = getAuth(app);
  return _auth;
}

export function getFirebaseAuth(): Auth {
  if (!_auth) throw new Error('Firebase has not been initialized. Call initFirebase() first.');
  return _auth;
}
```

- `initFirebase` validates config before calling `initializeApp`, giving a controlled error message
- `initFirebase` is idempotent — safe to call multiple times, returns the same instance
- `getFirebaseAuth` is for callers outside `AuthProvider` (`signInWithGoogle`, `signOut`) — throws fast with a clear message if called before init
- `validateFirebaseEnv` removed — validation is now inside `initFirebase`
- Module-level `auth` export removed — no compile-time `process.env` references remain

### 3. `src/contexts/auth-context.tsx` (update)

Add `authError: Error | null` to `AuthContextValue`:

```ts
export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  authError: Error | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}
```

### 4. `src/components/providers/auth-provider.tsx` (update)

```tsx
'use client';

import { useEffect, useState } from 'react';
import { type User, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { initFirebase, getFirebaseAuth } from '@/lib/firebase';
import { getFirebaseConfig } from '@/actions/firebase-config';
import { AuthContext } from '@/contexts/auth-context';
import { setAuthTokenGetter } from '@/lib/api-client';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<Error | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let settled = false;

    async function init() {
      try {
        const config = await getFirebaseConfig();
        const auth = initFirebase(config);

        setAuthTokenGetter(async () => {
          const currentUser = auth.currentUser;
          if (!currentUser) return null;
          return await currentUser.getIdToken();
        });

        unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
          setUser(firebaseUser);
          setLoading(false);
        });
      } catch (err) {
        if (!settled) {
          setAuthError(err instanceof Error ? err : new Error('Failed to initialize Firebase'));
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      settled = true;
      unsubscribe?.();
      setAuthTokenGetter(() => Promise.resolve(null));
    };
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(getFirebaseAuth(), provider);
  };

  const signOut = async () => {
    await firebaseSignOut(getFirebaseAuth());
  };

  return (
    <AuthContext.Provider value={{ user, loading, authError, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
```

- `loading` stays `true` until config fetch and first auth state both resolve
- `authError` exposed via context so consumers (login page, error boundary) can surface config failures
- `settled` flag prevents stale state updates if the component unmounts before the config fetch resolves (React 18 silently ignores updates on unmounted components, but `settled` makes the intent explicit)
- `signInWithGoogle` and `signOut` use `getFirebaseAuth()` — only callable after user interaction, by which time init is complete. If somehow called during the brief async init window, `getFirebaseAuth()` throws `'Firebase has not been initialized'` which propagates as an unhandled rejection to the caller.
- `setAuthTokenGetter` reset in cleanup always runs on unmount regardless of init success — this is safe because `api-client.ts` guards with `if (getToken)` before calling the getter.
- Cleanup uses `unsubscribe?.()` — no-op if init failed before `onAuthStateChanged` was set up.

### 5. `frontend/next.config.ts` (cleanup)

Remove the `env` block entirely:

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

export default nextConfig;
```

## Error Handling

| Scenario | Behaviour |
|---|---|
| Env var missing on server | `getFirebaseConfig` returns `undefined` for that key; `initFirebase` throws controlled error; caught by `try/catch`; `authError` set; `loading` false |
| Component unmounts before config fetch resolves | `settled = true` in cleanup prevents stale `setAuthError`/`setLoading` calls. React 18 also silently ignores state updates on unmounted components. |
| `getFirebaseAuth()` called before init completes | Throws `'Firebase has not been initialized'` — propagates as unhandled rejection to caller (`signInWithGoogle`/`signOut`). In practice, these are only triggered by user interaction after the page is interactive, by which time init is complete. |
| `setAuthTokenGetter` reset when init never ran | Safe — `api-client.ts` guards with `if (getToken)` before invoking the getter. |

## Testing

### `src/actions/firebase-config.spec.ts` (new)
- Returns correct shape `{ apiKey, authDomain, projectId }` when all env vars set (`vi.stubEnv`)
- Returns `undefined` values for absent env vars
- Note: `'use server'` boundary is not unit-testable; build-level enforcement is out of scope

### `src/lib/firebase.spec.ts` (rewrite — existing tests no longer apply)
- `initFirebase` initializes and returns an `Auth` instance when config is valid
- `initFirebase` is idempotent — second call returns same instance without reinitializing
- `initFirebase` throws with controlled message when any config value is `undefined`
- `getFirebaseAuth` throws `'Firebase has not been initialized'` before `initFirebase` is called
- `getFirebaseAuth` returns the instance after `initFirebase` is called

### `src/contexts/auth-context.tsx`
- No new tests needed — `AuthContextValue` is a type-only change

### `src/components/providers/auth-provider.spec.tsx` (update)

The existing mock `vi.mock('@/lib/firebase', () => ({ auth: {} }))` must be replaced with:
```ts
vi.mock('@/lib/firebase', () => ({
  initFirebase: mockInitFirebase,
  getFirebaseAuth: mockGetFirebaseAuth,
}));
```
And `getFirebaseConfig` server action must be mocked:
```ts
vi.mock('@/actions/firebase-config', () => ({
  getFirebaseConfig: mockGetFirebaseConfig,
}));
```

Test scenarios:
- `loading` is `true` during async init (before config fetch resolves)
- `loading` becomes `false` after `onAuthStateChanged` fires
- `authError` is set and `loading` is `false` when `getFirebaseConfig` rejects
- `authError` is set and `loading` is `false` when `initFirebase` throws (e.g. missing config)
- `onAuthStateChanged` is wired up after successful init
- Auth token getter is registered with `setAuthTokenGetter` after successful init
- `signInWithGoogle`/`signOut` call `getFirebaseAuth()` to retrieve the auth instance
