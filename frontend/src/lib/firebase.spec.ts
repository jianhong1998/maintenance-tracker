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
        }),
      ).toThrow('Missing required Firebase config');
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
