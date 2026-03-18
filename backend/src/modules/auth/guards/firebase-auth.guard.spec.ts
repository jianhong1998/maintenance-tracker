import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { FirebaseService } from 'src/modules/firebase/firebase.service';
import { AuthService } from '../services/auth.service';
import { EnvironmentVariableUtil } from 'src/modules/common/utils/environment-variable.util';

const mockVerifyIdToken = vi.fn();
const mockFirebaseService = {
  app: {
    auth: () => ({ verifyIdToken: mockVerifyIdToken }),
  },
};

const mockAuthService = {
  resolveUser: vi.fn(),
};

function makeEnvUtil(enableApiTestMode = false) {
  return {
    getFeatureFlags: vi.fn(() => ({ enableApiTestMode })),
  };
}

function makeContext(authHeader?: string): ExecutionContext {
  const request = {
    headers: { authorization: authHeader },
    user: undefined as unknown,
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

async function buildGuard(
  enableApiTestMode = false,
): Promise<FirebaseAuthGuard> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      FirebaseAuthGuard,
      { provide: FirebaseService, useValue: mockFirebaseService },
      { provide: AuthService, useValue: mockAuthService },
      {
        provide: EnvironmentVariableUtil,
        useValue: makeEnvUtil(enableApiTestMode),
      },
    ],
  }).compile();

  return module.get<FirebaseAuthGuard>(FirebaseAuthGuard);
}

describe('FirebaseAuthGuard', () => {
  let guard: FirebaseAuthGuard;

  beforeEach(async () => {
    vi.clearAllMocks();
    guard = await buildGuard();
  });

  it('throws UnauthorizedException when Authorization header is missing', async () => {
    await expect(guard.canActivate(makeContext(undefined))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when bearer token is missing', async () => {
    await expect(guard.canActivate(makeContext('Bearer '))).rejects.toThrow(
      'Missing bearer token',
    );
  });

  it('throws UnauthorizedException when token is invalid', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('invalid token'));
    await expect(
      guard.canActivate(makeContext('Bearer bad-token')),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when token has no email', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'firebase-uid-1' });
    await expect(
      guard.canActivate(makeContext('Bearer valid-token')),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('attaches resolved user to request and returns true for valid token', async () => {
    const decodedToken = { uid: 'firebase-uid-1', email: 'user@example.com' };
    const resolvedUser = {
      id: 'user-1',
      email: 'user@example.com',
      firebaseUid: 'firebase-uid-1',
    };
    mockVerifyIdToken.mockResolvedValue(decodedToken);
    mockAuthService.resolveUser.mockResolvedValue(resolvedUser);

    const ctx = makeContext('Bearer valid-token');
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    const request = ctx.switchToHttp().getRequest<{ user: unknown }>();
    expect(request.user).toEqual(resolvedUser);
  });

  describe('API test mode (BACKEND_ENABLE_API_TEST_MODE=true)', () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      guard = await buildGuard(true);
    });

    it('resolves test user and returns true for the api-test-token', async () => {
      const testUser = {
        id: 'test-user-id',
        email: 'api-test@example.com',
        firebaseUid: 'api-test-uid',
      };
      mockAuthService.resolveUser.mockResolvedValue(testUser);

      const ctx = makeContext('Bearer api-test-token');
      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(mockAuthService.resolveUser).toHaveBeenCalledWith({
        firebaseUid: 'api-test-uid',
        email: 'api-test@example.com',
      });
      expect(mockVerifyIdToken).not.toHaveBeenCalled();
      const request = ctx.switchToHttp().getRequest<{ user: unknown }>();
      expect(request.user).toEqual(testUser);
    });

    it('falls through to Firebase verification for non-test tokens', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('invalid'));

      await expect(
        guard.canActivate(makeContext('Bearer some-real-token')),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockVerifyIdToken).toHaveBeenCalledWith('some-real-token');
    });
  });

  describe('api-test-token is rejected when API test mode is disabled', () => {
    it('falls through to Firebase verification and throws for the api-test-token', async () => {
      mockVerifyIdToken.mockRejectedValue(
        new Error('not a real firebase token'),
      );

      await expect(
        guard.canActivate(makeContext('Bearer api-test-token')),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockVerifyIdToken).toHaveBeenCalledWith('api-test-token');
    });
  });
});
