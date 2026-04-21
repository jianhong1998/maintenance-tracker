import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { FirebaseService } from 'src/modules/firebase/firebase.service';
import { AuthService } from '../services/auth.service';
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FirebaseAuthGuard,
        { provide: FirebaseService, useValue: mockFirebaseService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: Reflector, useValue: mockReflector },
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
});
