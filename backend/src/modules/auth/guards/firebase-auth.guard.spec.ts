import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { FirebaseService } from 'src/modules/firebase/firebase.service';
import { AuthService } from '../services/auth.service';
import { EnvironmentVariableUtil } from 'src/modules/common/utils/environment-variable.util';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

const mockVerifyIdToken = vi.fn();
const mockFirebaseService = {
  app: {
    auth: () => ({ verifyIdToken: mockVerifyIdToken }),
  },
};

const mockAuthService = {
  resolveUser: vi.fn(),
};

const mockReflector = {
  getAllAndOverride: vi.fn(),
};

const mockEnvUtil = {
  getFeatureFlags: vi.fn(),
};

function makeContext(authHeader?: string): ExecutionContext {
  const request = {
    headers: { authorization: authHeader },
    user: undefined as unknown,
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('FirebaseAuthGuard', () => {
  let guard: FirebaseAuthGuard;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockReflector.getAllAndOverride.mockReturnValue(false);
    mockEnvUtil.getFeatureFlags.mockReturnValue({ enableApiTestMode: false });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FirebaseAuthGuard,
        { provide: FirebaseService, useValue: mockFirebaseService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: Reflector, useValue: mockReflector },
        { provide: EnvironmentVariableUtil, useValue: mockEnvUtil },
      ],
    }).compile();

    guard = module.get<FirebaseAuthGuard>(FirebaseAuthGuard);
  });

  it('returns true immediately for public routes (skips auth)', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(true);
    const ctx = makeContext(undefined);
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
    expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
      IS_PUBLIC_KEY,
      [expect.anything(), expect.anything()],
    );
  });

  it('throws UnauthorizedException when Authorization header is missing', async () => {
    await expect(guard.canActivate(makeContext(undefined))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when token is invalid', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('invalid token'));
    await expect(
      guard.canActivate(makeContext('Bearer bad-token')),
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

  describe('API test mode', () => {
    it('skips Firebase verification and resolves test user when api test mode is enabled and token is api-test-token', async () => {
      mockEnvUtil.getFeatureFlags.mockReturnValue({ enableApiTestMode: true });
      const testUser = {
        id: 'test-user-id',
        email: 'api-test@test.com',
        firebaseUid: 'api-test-uid',
      };
      mockAuthService.resolveUser.mockResolvedValue(testUser);

      const ctx = makeContext('Bearer api-test-token');
      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(mockVerifyIdToken).not.toHaveBeenCalled();
      expect(mockAuthService.resolveUser).toHaveBeenCalledWith({
        firebaseUid: 'api-test-uid',
        email: 'api-test@test.com',
      });
      const request = ctx.switchToHttp().getRequest<{ user: unknown }>();
      expect(request.user).toEqual(testUser);
    });

    it('still verifies with Firebase when api test mode is enabled but token is not api-test-token', async () => {
      mockEnvUtil.getFeatureFlags.mockReturnValue({ enableApiTestMode: true });
      const decodedToken = { uid: 'firebase-uid-1', email: 'user@example.com' };
      const resolvedUser = {
        id: 'user-1',
        email: 'user@example.com',
        firebaseUid: 'firebase-uid-1',
      };
      mockVerifyIdToken.mockResolvedValue(decodedToken);
      mockAuthService.resolveUser.mockResolvedValue(resolvedUser);

      const ctx = makeContext('Bearer real-firebase-token');
      await guard.canActivate(ctx);

      expect(mockVerifyIdToken).toHaveBeenCalledWith('real-firebase-token');
    });

    it('still verifies with Firebase when api test mode is disabled even if token is api-test-token', async () => {
      mockEnvUtil.getFeatureFlags.mockReturnValue({ enableApiTestMode: false });
      mockVerifyIdToken.mockRejectedValue(new Error('invalid token'));

      await expect(
        guard.canActivate(makeContext('Bearer api-test-token')),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockVerifyIdToken).toHaveBeenCalledWith('api-test-token');
    });
  });
});
