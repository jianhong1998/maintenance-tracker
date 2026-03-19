import { Test, TestingModule } from '@nestjs/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryFailedError } from 'typeorm';
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

    it('returns existing user when create races with a concurrent insert (unique violation, re-query succeeds)', async () => {
      const racedUser = {
        id: 'user-3',
        email: 'race@example.com',
        firebaseUid: 'firebase-uid-3',
        createdAt: new Date(),
      };
      const uniqueError = Object.assign(
        new QueryFailedError('INSERT', [], new Error()),
        { code: '23505' },
      );
      mockUserRepository.getOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(racedUser);
      mockUserRepository.create.mockRejectedValue(uniqueError);

      const result = await service.resolveUser({
        firebaseUid: 'firebase-uid-3',
        email: 'race@example.com',
      });

      expect(result).toEqual(racedUser);
    });

    it('throws descriptive error when unique violation occurs but re-query returns null', async () => {
      const uniqueError = Object.assign(
        new QueryFailedError('INSERT', [], new Error()),
        { code: '23505' },
      );
      mockUserRepository.getOne.mockResolvedValue(null);
      mockUserRepository.create.mockRejectedValue(uniqueError);

      await expect(
        service.resolveUser({
          firebaseUid: 'firebase-uid-4',
          email: 'ghost@example.com',
        }),
      ).rejects.toThrow(
        'Unique violation on INSERT but re-query returned null for firebaseUid=firebase-uid-4',
      );
    });

    it('re-throws non-unique QueryFailedError without re-querying', async () => {
      const dbError = Object.assign(
        new QueryFailedError('INSERT', [], new Error()),
        { code: '42601' },
      );
      mockUserRepository.getOne.mockResolvedValue(null);
      mockUserRepository.create.mockRejectedValue(dbError);

      await expect(
        service.resolveUser({
          firebaseUid: 'firebase-uid-5',
          email: 'err@example.com',
        }),
      ).rejects.toBe(dbError);
      expect(mockUserRepository.getOne).toHaveBeenCalledTimes(1);
    });
  });
});
