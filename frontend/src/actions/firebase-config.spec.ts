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
      authEmulatorHost: undefined,
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

  it('returns authEmulatorHost when FRONTEND_ENABLE_MOCK_AUTH=true and host is set', async () => {
    vi.stubEnv('FRONTEND_ENABLE_MOCK_AUTH', 'true');
    vi.stubEnv('FRONTEND_FIREBASE_AUTH_EMULATOR_HOST', 'localhost:9099');
    const { getFirebaseConfig } = await import('./firebase-config');
    const config = await getFirebaseConfig();
    expect(config.authEmulatorHost).toBe('localhost:9099');
  });

  it('omits authEmulatorHost when FRONTEND_ENABLE_MOCK_AUTH=false even if host is set', async () => {
    vi.stubEnv('FRONTEND_ENABLE_MOCK_AUTH', 'false');
    vi.stubEnv('FRONTEND_FIREBASE_AUTH_EMULATOR_HOST', 'localhost:9099');
    const { getFirebaseConfig } = await import('./firebase-config');
    const config = await getFirebaseConfig();
    expect(config.authEmulatorHost).toBeUndefined();
  });

  it('throws when FRONTEND_ENABLE_MOCK_AUTH=true but host is missing', async () => {
    vi.stubEnv('FRONTEND_ENABLE_MOCK_AUTH', 'true');
    vi.stubEnv('FRONTEND_FIREBASE_AUTH_EMULATOR_HOST', '');
    const { getFirebaseConfig } = await import('./firebase-config');
    await expect(getFirebaseConfig()).rejects.toThrow(
      /FRONTEND_FIREBASE_AUTH_EMULATOR_HOST/,
    );
  });
});
