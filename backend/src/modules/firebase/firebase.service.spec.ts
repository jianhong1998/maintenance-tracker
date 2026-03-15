import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock firebase-admin before importing FirebaseService to avoid real SDK validation
vi.mock('firebase-admin', () => {
  const mockApp = { name: 'test-app' };
  const mockApps: unknown[] = [];
  const adminModule = {
    apps: mockApps,
    app: () => mockApp,
    initializeApp: vi.fn(() => {
      mockApps.push(mockApp);
      return mockApp;
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

describe('FirebaseService', () => {
  let service: FirebaseService;

  const mockConfigService = {
    getOrThrow: (key: string) => {
      const values: Record<string, string> = {
        FIREBASE_PROJECT_ID: 'test-project',
        FIREBASE_CLIENT_EMAIL: 'test@test-project.iam.gserviceaccount.com',
        FIREBASE_PRIVATE_KEY: 'fake-private-key',
      };
      return values[key];
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FirebaseService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    await module.init();
    service = module.get<FirebaseService>(FirebaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should expose a Firebase app instance', () => {
    expect(service.app).toBeDefined();
  });
});
