# Firebase Runtime Environment Variables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace compile-time Firebase env var substitution with a Server Action that reads `process.env` at runtime, so Firebase config is never baked into the JS bundle.

**Architecture:** A `'use server'` action returns Firebase config from server-side `process.env`. `firebase.ts` exposes a lazy `initFirebase(config)` + `getFirebaseAuth()` API instead of a module-level singleton. `AuthProvider` calls the action on mount, initializes Firebase, then subscribes to auth state.

**Tech Stack:** Next.js 15 App Router, Firebase JS SDK, Vitest, React Testing Library

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `frontend/src/actions/firebase-config.ts` | Create | Server Action that reads Firebase env vars at request time |
| `frontend/src/actions/firebase-config.spec.ts` | Create | Unit tests for the server action |
| `frontend/src/lib/firebase.ts` | Rewrite | Lazy init API: `initFirebase(config)` + `getFirebaseAuth()` |
| `frontend/src/lib/firebase.spec.ts` | Rewrite | Unit tests for new firebase.ts API |
| `frontend/src/contexts/auth-context.tsx` | Modify | Add `authError: Error \| null` to `AuthContextValue` |
| `frontend/src/components/providers/auth-provider.tsx` | Modify | Async init via server action, error state handling |
| `frontend/src/components/providers/auth-provider.spec.tsx` | Modify | Update mocks + add async init and error test cases |
| `frontend/next.config.ts` | Modify | Remove `env` block entirely |

---

## Task 1: Server Action — `getFirebaseConfig`

**Files:**
- Create: `frontend/src/actions/firebase-config.ts`
- Create: `frontend/src/actions/firebase-config.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/actions/firebase-config.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('getFirebaseConfig', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('FRONTEND_FIREBASE_API_KEY', 'test-api-key');
    vi.stubEnv('FRONTEND_FIREBASE_AUTH_DOMAIN', 'test.firebaseapp.com');
    vi.stubEnv('FRONTEND_FIREBASE_PROJECT_ID', 'test-project-id');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns correct config shape when all env vars are set', async () => {
    const { getFirebaseConfig } = await import('./firebase-config');
    const config = await getFirebaseConfig();
    expect(config).toEqual({
      apiKey: 'test-api-key',
      authDomain: 'test.firebaseapp.com',
      projectId: 'test-project-id',
    });
  });

  it('returns undefined for apiKey when env var is absent', async () => {
    vi.stubEnv('FRONTEND_FIREBASE_API_KEY', '');
    const { getFirebaseConfig } = await import('./firebase-config');
    const config = await getFirebaseConfig();
    expect(config.apiKey).toBeFalsy();
  });

  it('returns undefined for authDomain when env var is absent', async () => {
    vi.stubEnv('FRONTEND_FIREBASE_AUTH_DOMAIN', '');
    const { getFirebaseConfig } = await import('./firebase-config');
    const config = await getFirebaseConfig();
    expect(config.authDomain).toBeFalsy();
  });

  it('returns undefined for projectId when env var is absent', async () => {
    vi.stubEnv('FRONTEND_FIREBASE_PROJECT_ID', '');
    const { getFirebaseConfig } = await import('./firebase-config');
    const config = await getFirebaseConfig();
    expect(config.projectId).toBeFalsy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && pnpm exec vitest run src/actions/firebase-config.spec.ts
```

Expected: FAIL — `Cannot find module './firebase-config'`

- [ ] **Step 3: Create the server action**

Create `frontend/src/actions/firebase-config.ts`:

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

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && pnpm exec vitest run src/actions/firebase-config.spec.ts
```

Expected: PASS — 4 tests pass

- [ ] **Step 5: Format and lint**

```bash
cd /Users/leejianhong/projects/personal-project/maintenance-tracker && just format && just lint
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/actions/firebase-config.ts frontend/src/actions/firebase-config.spec.ts
git commit -m "add getFirebaseConfig server action with tests"
```

---

## Task 2: Rewrite `firebase.ts` with lazy init API

**Files:**
- Modify: `frontend/src/lib/firebase.ts`
- Modify: `frontend/src/lib/firebase.spec.ts`

- [ ] **Step 1: Rewrite the tests first**

Replace the entire contents of `frontend/src/lib/firebase.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase/app', () => ({
  getApps: vi.fn(() => []),
  initializeApp: vi.fn(() => ({ name: 'test-app' })),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ name: 'test-auth' })),
}));

const validConfig = {
  apiKey: 'test-key',
  authDomain: 'test.firebaseapp.com',
  projectId: 'test-project',
};

describe('firebase', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('initFirebase', () => {
    it('initializes and returns an Auth instance when config is valid', async () => {
      const { initFirebase } = await import('@/lib/firebase');
      const auth = initFirebase(validConfig);
      expect(auth).toBeDefined();
    });

    it('is idempotent — second call returns same instance without reinitializing', async () => {
      const { initFirebase } = await import('@/lib/firebase');
      const { initializeApp } = await import('firebase/app');
      const auth1 = initFirebase(validConfig);
      const auth2 = initFirebase(validConfig);
      expect(auth1).toBe(auth2);
      expect(initializeApp).toHaveBeenCalledTimes(1);
    });

    it('throws with controlled message when apiKey is undefined', async () => {
      const { initFirebase } = await import('@/lib/firebase');
      expect(() => initFirebase({ ...validConfig, apiKey: undefined })).toThrow(
        'Missing required Firebase config: apiKey',
      );
    });

    it('throws with controlled message when multiple config values are undefined', async () => {
      const { initFirebase } = await import('@/lib/firebase');
      expect(() =>
        initFirebase({ apiKey: undefined, authDomain: undefined, projectId: 'test' }),
      ).toThrow('Missing required Firebase config');
    });
  });

  describe('getFirebaseAuth', () => {
    it('throws before initFirebase is called', async () => {
      const { getFirebaseAuth } = await import('@/lib/firebase');
      expect(() => getFirebaseAuth()).toThrow('Firebase has not been initialized');
    });

    it('returns auth instance after initFirebase is called', async () => {
      const { initFirebase, getFirebaseAuth } = await import('@/lib/firebase');
      initFirebase(validConfig);
      expect(getFirebaseAuth()).toBeDefined();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && pnpm exec vitest run src/lib/firebase.spec.ts
```

Expected: FAIL — `initFirebase is not a function` (old API doesn't match)

- [ ] **Step 3: Rewrite `firebase.ts`**

Replace the entire contents of `frontend/src/lib/firebase.ts`:

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

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && pnpm exec vitest run src/lib/firebase.spec.ts
```

Expected: PASS — 6 tests pass

- [ ] **Step 5: Format and lint**

```bash
cd /Users/leejianhong/projects/personal-project/maintenance-tracker && just format && just lint
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/firebase.ts frontend/src/lib/firebase.spec.ts
git commit -m "rewrite firebase.ts with lazy initFirebase and getFirebaseAuth"
```

---

## Task 3: Add `authError` to `AuthContextValue`

**Files:**
- Modify: `frontend/src/contexts/auth-context.tsx`

This is a type-only change. No new tests needed — TypeScript will enforce correct usage at compile time.

- [ ] **Step 1: Update `AuthContextValue`**

In `frontend/src/contexts/auth-context.tsx`, add `authError: Error | null` to the interface:

```ts
export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  authError: Error | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && pnpm exec tsc --noEmit
```

Expected: TypeScript errors on `auth-provider.tsx` — it no longer satisfies `AuthContextValue` (missing `authError`). This is expected and will be fixed in Task 4.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/contexts/auth-context.tsx
git commit -m "add authError field to AuthContextValue"
```

---

## Task 4: Update `AuthProvider` with async init

**Files:**
- Modify: `frontend/src/components/providers/auth-provider.tsx`
- Modify: `frontend/src/components/providers/auth-provider.spec.tsx`

- [ ] **Step 1: Rewrite the tests**

Replace the entire contents of `frontend/src/components/providers/auth-provider.spec.tsx`:

```tsx
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AuthProvider } from '@/components/providers/auth-provider';
import { useAuthContext } from '@/contexts/auth-context';
import type { User } from 'firebase/auth';

const {
  mockOnAuthStateChanged,
  mockSetAuthTokenGetter,
  mockGetFirebaseConfig,
  mockInitFirebase,
  mockGetFirebaseAuth,
} = vi.hoisted(() => ({
  mockOnAuthStateChanged: vi.fn(),
  mockSetAuthTokenGetter: vi.fn(),
  mockGetFirebaseConfig: vi.fn(),
  mockInitFirebase: vi.fn(),
  mockGetFirebaseAuth: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(),
  onAuthStateChanged: mockOnAuthStateChanged,
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/lib/firebase', () => ({
  initFirebase: mockInitFirebase,
  getFirebaseAuth: mockGetFirebaseAuth,
}));

vi.mock('@/actions/firebase-config', () => ({
  getFirebaseConfig: mockGetFirebaseConfig,
}));

vi.mock('@/lib/api-client', () => ({
  setAuthTokenGetter: mockSetAuthTokenGetter,
}));

const testConfig = {
  apiKey: 'test-key',
  authDomain: 'test.firebaseapp.com',
  projectId: 'test-project',
};

const mockAuthInstance = { name: 'test-auth' };

function TestConsumer() {
  const { user, loading, authError } = useAuthContext();
  return (
    <div>
      <span data-testid="loading">{loading ? 'loading' : 'ready'}</span>
      <span data-testid="user">{user ? (user.email ?? 'no-email') : 'null'}</span>
      <span data-testid="error">{authError ? authError.message : 'none'}</span>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFirebaseConfig.mockResolvedValue(testConfig);
    mockInitFirebase.mockReturnValue(mockAuthInstance);
    mockGetFirebaseAuth.mockReturnValue(mockAuthInstance);
    mockOnAuthStateChanged.mockReturnValue(vi.fn()); // default unsubscribe
  });

  it('starts in loading state before auth resolves', () => {
    // onAuthStateChanged never calls callback — simulates in-flight auth check
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId('loading')).toHaveTextContent('loading');
    expect(screen.getByTestId('user')).toHaveTextContent('null');
  });

  it('transitions to ready with user when auth state resolves with a user', async () => {
    let authCallback!: (user: User | null) => void;
    mockOnAuthStateChanged.mockImplementation(
      (_auth: unknown, cb: (user: User | null) => void) => {
        authCallback = cb;
        return vi.fn();
      },
    );

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    const mockUser = {
      email: 'test@example.com',
      getIdToken: vi.fn().mockResolvedValue('token'),
    } as unknown as User;

    await waitFor(() => expect(authCallback).toBeDefined());
    act(() => authCallback(mockUser));

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    });
  });

  it('transitions to ready with null user when signed out', async () => {
    let authCallback!: (user: User | null) => void;
    mockOnAuthStateChanged.mockImplementation(
      (_auth: unknown, cb: (user: User | null) => void) => {
        authCallback = cb;
        return vi.fn();
      },
    );

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(authCallback).toBeDefined());
    act(() => authCallback(null));

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      expect(screen.getByTestId('user')).toHaveTextContent('null');
    });
  });

  it('sets authError and loading=false when getFirebaseConfig rejects', async () => {
    mockGetFirebaseConfig.mockRejectedValue(new Error('Config fetch failed'));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      expect(screen.getByTestId('error')).toHaveTextContent('Config fetch failed');
    });
  });

  it('sets authError and loading=false when initFirebase throws', async () => {
    mockInitFirebase.mockImplementation(() => {
      throw new Error('Missing required Firebase config: apiKey');
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      expect(screen.getByTestId('error')).toHaveTextContent(
        'Missing required Firebase config: apiKey',
      );
    });
  });

  it('wires up auth token getter after successful init', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(mockSetAuthTokenGetter).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  it('wires up onAuthStateChanged after successful init', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(mockOnAuthStateChanged).toHaveBeenCalledWith(
        mockAuthInstance,
        expect.any(Function),
      );
    });
  });

  it('signInWithGoogle calls getFirebaseAuth to retrieve auth instance', async () => {
    const { signInWithPopup } = await import('firebase/auth');

    function SignInButton() {
      const { signInWithGoogle } = useAuthContext();
      return <button onClick={signInWithGoogle}>Sign In</button>;
    }

    render(
      <AuthProvider>
        <SignInButton />
      </AuthProvider>,
    );

    await waitFor(() => expect(mockInitFirebase).toHaveBeenCalled());

    await act(async () => {
      screen.getByRole('button', { name: 'Sign In' }).click();
    });

    expect(mockGetFirebaseAuth).toHaveBeenCalled();
    expect(signInWithPopup).toHaveBeenCalledWith(mockAuthInstance, expect.any(Object));
  });

  it('signOut calls getFirebaseAuth to retrieve auth instance', async () => {
    const { signOut: firebaseSignOut } = await import('firebase/auth');

    function SignOutButton() {
      const { signOut } = useAuthContext();
      return <button onClick={signOut}>Sign Out</button>;
    }

    render(
      <AuthProvider>
        <SignOutButton />
      </AuthProvider>,
    );

    await waitFor(() => expect(mockInitFirebase).toHaveBeenCalled());

    await act(async () => {
      screen.getByRole('button', { name: 'Sign Out' }).click();
    });

    expect(mockGetFirebaseAuth).toHaveBeenCalled();
    expect(firebaseSignOut).toHaveBeenCalledWith(mockAuthInstance);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && pnpm exec vitest run src/components/providers/auth-provider.spec.tsx
```

Expected: FAIL — mock for `@/actions/firebase-config` not found, and `authError` missing from context

- [ ] **Step 3: Update `AuthProvider`**

Replace the entire contents of `frontend/src/components/providers/auth-provider.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import {
  type User,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
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
          setAuthError(
            err instanceof Error ? err : new Error('Failed to initialize Firebase'),
          );
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

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && pnpm exec vitest run src/components/providers/auth-provider.spec.tsx
```

Expected: PASS — all tests pass

- [ ] **Step 5: Run all frontend tests to catch regressions**

```bash
cd frontend && pnpm exec vitest run
```

Expected: PASS — no regressions

- [ ] **Step 6: Format and lint**

```bash
cd /Users/leejianhong/projects/personal-project/maintenance-tracker && just format && just lint
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/providers/auth-provider.tsx \
        frontend/src/components/providers/auth-provider.spec.tsx
git commit -m "update AuthProvider to init Firebase via server action"
```

---

## Task 5: Clean up `next.config.ts`

**Files:**
- Modify: `frontend/next.config.ts`

No tests — this is config-only. TypeScript build verification is sufficient.

- [ ] **Step 1: Remove the `env` block**

Replace the entire contents of `frontend/next.config.ts`:

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
cd frontend && pnpm exec tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Run all frontend tests one final time**

```bash
cd frontend && pnpm exec vitest run
```

Expected: PASS — all tests pass

- [ ] **Step 4: Format and lint**

```bash
cd /Users/leejianhong/projects/personal-project/maintenance-tracker && just format && just lint
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add frontend/next.config.ts
git commit -m "remove compile-time Firebase env block from next.config.ts"
```
