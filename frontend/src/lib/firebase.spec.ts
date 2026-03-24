import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('firebase/app', () => ({
  getApps: vi.fn(() => []),
  initializeApp: vi.fn(() => ({})),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
}));

describe('Firebase module initialization', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('FRONTEND_FIREBASE_API_KEY', 'test-api-key');
    vi.stubEnv('FRONTEND_FIREBASE_AUTH_DOMAIN', 'test.firebaseapp.com');
    vi.stubEnv('FRONTEND_FIREBASE_PROJECT_ID', 'test-project');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws with missing var name when API key is absent', async () => {
    vi.stubEnv('FRONTEND_FIREBASE_API_KEY', '');
    await expect(import('@/lib/firebase')).rejects.toThrow(
      'FRONTEND_FIREBASE_API_KEY',
    );
  });

  it('throws with missing var name when auth domain is absent', async () => {
    vi.stubEnv('FRONTEND_FIREBASE_AUTH_DOMAIN', '');
    await expect(import('@/lib/firebase')).rejects.toThrow(
      'FRONTEND_FIREBASE_AUTH_DOMAIN',
    );
  });

  it('throws with missing var name when project ID is absent', async () => {
    vi.stubEnv('FRONTEND_FIREBASE_PROJECT_ID', '');
    await expect(import('@/lib/firebase')).rejects.toThrow(
      'FRONTEND_FIREBASE_PROJECT_ID',
    );
  });

  it('initializes without error when all required env vars are present', async () => {
    await expect(import('@/lib/firebase')).resolves.toHaveProperty('auth');
  });
});
