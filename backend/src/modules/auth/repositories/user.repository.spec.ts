import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { UserRepository } from './user.repository';
import { UserEntity } from 'src/db/entities/user.entity';

const mockTypeOrmRepo = {
  create: vi.fn(),
  save: vi.fn(),
};

describe('UserRepository', () => {
  let repository: UserRepository;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserRepository,
        { provide: getRepositoryToken(UserEntity), useValue: mockTypeOrmRepo },
      ],
    }).compile();

    repository = module.get<UserRepository>(UserRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('#create', () => {
    it('creates and saves a new user', async () => {
      const newUser = {
        id: 'user-1',
        email: 'test@example.com',
        firebaseUid: 'uid-1',
        createdAt: new Date(),
      } as UserEntity;

      mockTypeOrmRepo.create.mockReturnValue(newUser);
      mockTypeOrmRepo.save.mockResolvedValue(newUser);

      const result = await repository.create({
        creationData: { email: 'test@example.com', firebaseUid: 'uid-1' },
      });

      expect(mockTypeOrmRepo.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        firebaseUid: 'uid-1',
      });
      expect(result).toEqual(newUser);
    });
  });
});
