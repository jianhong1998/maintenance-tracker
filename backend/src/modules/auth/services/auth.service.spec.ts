import { Test, TestingModule } from '@nestjs/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from './auth.service';
import { UserRepository } from '../repositories/user.repository';

const mockUserRepository = {
  getOne: vi.fn(),
  create: vi.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserRepository, useValue: mockUserRepository },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('#resolveUser', () => {
    it('returns existing user when found by firebaseUid', async () => {
      const existingUser = {
        id: 'user-1',
        email: 'test@example.com',
        firebaseUid: 'firebase-uid-1',
        createdAt: new Date(),
      };
      mockUserRepository.getOne.mockResolvedValue(existingUser);

      const result = await service.resolveUser({
        firebaseUid: 'firebase-uid-1',
        email: 'test@example.com',
      });

      expect(result).toEqual(existingUser);
      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it('creates and returns new user when not found', async () => {
      const newUser = {
        id: 'user-2',
        email: 'new@example.com',
        firebaseUid: 'firebase-uid-2',
        createdAt: new Date(),
      };
      mockUserRepository.getOne.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(newUser);

      const result = await service.resolveUser({
        firebaseUid: 'firebase-uid-2',
        email: 'new@example.com',
      });

      expect(result).toEqual(newUser);
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        creationData: {
          email: 'new@example.com',
          firebaseUid: 'firebase-uid-2',
        },
      });
    });
  });
});
