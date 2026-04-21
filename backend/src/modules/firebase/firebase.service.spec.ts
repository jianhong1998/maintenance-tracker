import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { vi, describe, it, expect, afterEach } from 'vitest';

vi.mock('firebase-admin', () => {
  const mockApps: { name: string }[] = [];
  const adminModule = {
    apps: mockApps,
    initializeApp: vi.fn((_opts: unknown, name: string) => {
      const app = { name };
      mockApps.push(app);
      return app;
    }),
    credential: {
      cert: vi.fn((creds: unknown) => creds as Record<string, unknown>),
    },
  };
  return {
    default: adminModule,
    ...adminModule,
  };
});

import { FirebaseService } from './firebase.service';
import { EnvironmentVariableUtil } from 'src/modules/common/utils/environment-variable.util';

type EnvMap = Record<string, string | undefined>;

function buildModule(envValues: EnvMap, flags: { enableMockAuth: boolean }) {
  const configService = {
    getOrThrow: (key: string) => {
      const value = envValues[key];
      if (value === undefined)
        throw new Error(`getOrThrow called for missing key: ${key}`);
      return value;
    },
  };
  const envUtil = {
    getFeatureFlags: () => ({
      enableMockAuth: flags.enableMockAuth,
      enableApiTestMode: false,
      enableHistory: false,
      enableProfile: false,
    }),
  };
  return Test.createTestingModule({
    providers: [
      FirebaseService,
      { provide: ConfigService, useValue: configService },
      { provide: EnvironmentVariableUtil, useValue: envUtil },
    ],
  }).compile();
}

const baseEnv: EnvMap = {
  FIREBASE_PROJECT_ID: 'test-project',
  FIREBASE_CLIENT_EMAIL: 'test@test-project.iam.gserviceaccount.com',
  FIREBASE_PRIVATE_KEY: 'fake-private-key',
  FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099',
};

describe('FirebaseService', () => {
  afterEach(() => {
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
  });

  it('exposes a Firebase app instance with the correct name', async () => {
    const module: TestingModule = await buildModule(baseEnv, {
      enableMockAuth: false,
    });
    await module.init();
    const service = module.get<FirebaseService>(FirebaseService);
    expect(service.app.name).toBe('maintenance-tracker');
  });

  it('sets process.env.FIREBASE_AUTH_EMULATOR_HOST when mock auth is enabled', async () => {
    const module: TestingModule = await buildModule(baseEnv, {
      enableMockAuth: true,
    });
    await module.init();
    expect(process.env.FIREBASE_AUTH_EMULATOR_HOST).toBe('localhost:9099');
  });

  it('throws at startup when mock auth is enabled but FIREBASE_AUTH_EMULATOR_HOST is missing', async () => {
    const env = { ...baseEnv, FIREBASE_AUTH_EMULATOR_HOST: undefined };
    const module: TestingModule = await buildModule(env, {
      enableMockAuth: true,
    });
    await expect(module.init()).rejects.toThrow(/FIREBASE_AUTH_EMULATOR_HOST/);
  });

  it('deletes process.env.FIREBASE_AUTH_EMULATOR_HOST when mock auth is disabled', async () => {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = 'leftover-from-other-tool:9099';
    const module: TestingModule = await buildModule(baseEnv, {
      enableMockAuth: false,
    });
    await module.init();
    expect(process.env.FIREBASE_AUTH_EMULATOR_HOST).toBeUndefined();
  });
});
