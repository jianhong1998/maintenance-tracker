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
