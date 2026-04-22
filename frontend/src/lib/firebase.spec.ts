import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase/app', () => ({
  getApps: vi.fn(() => []),
  initializeApp: vi.fn(() => ({ name: 'test-app' })),
}));

const mockConnectAuthEmulator = vi.fn();
const mockSignInWithEmailAndPassword = vi.fn();

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ name: 'test-auth' })),
  connectAuthEmulator: (...args: unknown[]) => mockConnectAuthEmulator(...args),
  signInWithEmailAndPassword: (...args: unknown[]) =>
    mockSignInWithEmailAndPassword(...args),
}));

const validConfig = {
  apiKey: 'test-key',
  authDomain: 'test.firebaseapp.com',
  projectId: 'test-project',
  authEmulatorHost: undefined as string | undefined,
};

describe('firebase', () => {
  beforeEach(() => {
    vi.resetModules();
    mockConnectAuthEmulator.mockReset();
    mockSignInWithEmailAndPassword.mockReset();
    // Clean up any window.__e2eAuth left over from a previous test
    if (typeof window !== 'undefined') {
      delete (window as unknown as { __e2eAuth?: unknown }).__e2eAuth;
    }
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
      vi.clearAllMocks();
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
        initFirebase({
          apiKey: undefined,
          authDomain: undefined,
          projectId: 'test',
          authEmulatorHost: undefined,
        }),
      ).toThrow('Missing required Firebase config');
    });

    it('does not call connectAuthEmulator when authEmulatorHost is undefined', async () => {
      const { initFirebase } = await import('@/lib/firebase');
      initFirebase(validConfig);
      expect(mockConnectAuthEmulator).not.toHaveBeenCalled();
    });

    it('calls connectAuthEmulator with http URL when authEmulatorHost is set', async () => {
      const { initFirebase } = await import('@/lib/firebase');
      initFirebase({ ...validConfig, authEmulatorHost: 'localhost:9099' });
      expect(mockConnectAuthEmulator).toHaveBeenCalledWith(
        expect.anything(),
        'http://localhost:9099',
        { disableWarnings: true },
      );
    });

    it('does not expose window.__e2eAuth when authEmulatorHost is undefined', async () => {
      const { initFirebase } = await import('@/lib/firebase');
      initFirebase(validConfig);
      expect(
        (window as unknown as { __e2eAuth?: unknown }).__e2eAuth,
      ).toBeUndefined();
    });

    it('exposes window.__e2eAuth.signIn when authEmulatorHost is set', async () => {
      const { initFirebase } = await import('@/lib/firebase');
      initFirebase({ ...validConfig, authEmulatorHost: 'localhost:9099' });
      const helper = (
        window as unknown as {
          __e2eAuth?: { signIn: (e: string, p: string) => Promise<void> };
        }
      ).__e2eAuth;
      expect(typeof helper?.signIn).toBe('function');
    });

    it('exposes window.__e2eAuth in production builds when authEmulatorHost is set — gating is runtime-only so pipeline E2E can hit the prod image', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      try {
        const { initFirebase } = await import('@/lib/firebase');
        initFirebase({ ...validConfig, authEmulatorHost: 'localhost:9099' });
        const helper = (
          window as unknown as {
            __e2eAuth?: { signIn: (e: string, p: string) => Promise<void> };
          }
        ).__e2eAuth;
        expect(typeof helper?.signIn).toBe('function');
      } finally {
        vi.unstubAllEnvs();
      }
    });
  });

  describe('getFirebaseAuth', () => {
    it('throws before initFirebase is called', async () => {
      const { getFirebaseAuth } = await import('@/lib/firebase');
      expect(() => getFirebaseAuth()).toThrow(
        'Firebase has not been initialized',
      );
    });

    it('returns auth instance after initFirebase is called', async () => {
      const { initFirebase, getFirebaseAuth } = await import('@/lib/firebase');
      initFirebase(validConfig);
      expect(getFirebaseAuth()).toBeDefined();
    });
  });
});
