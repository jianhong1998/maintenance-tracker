import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MaintenanceHistoryRepository } from './maintenance-history.repository';
import { MaintenanceHistoryEntity } from 'src/db/entities/maintenance-history.entity';

const mockTypeOrmRepo = {
  create: vi.fn(),
  save: vi.fn(),
  find: vi.fn(),
};

describe('MaintenanceHistoryRepository', () => {
  let repository: MaintenanceHistoryRepository;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceHistoryRepository,
        {
          provide: getRepositoryToken(MaintenanceHistoryEntity),
          useValue: mockTypeOrmRepo,
        },
      ],
    }).compile();

    repository = module.get<MaintenanceHistoryRepository>(
      MaintenanceHistoryRepository,
    );
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('#create', () => {
    it('creates and saves a new history record', async () => {
      const doneAt = new Date('2026-03-15');
      const newHistory = {
        id: 'history-1',
        maintenanceCardId: 'card-1',
        doneAtMileage: 12500,
        doneAtDate: doneAt,
        notes: null,
        createdAt: new Date(),
      } as MaintenanceHistoryEntity;

      mockTypeOrmRepo.create.mockReturnValue(newHistory);
      mockTypeOrmRepo.save.mockResolvedValue(newHistory);

      const result = await repository.create({
        creationData: {
          maintenanceCardId: 'card-1',
          doneAtMileage: 12500,
          doneAtDate: doneAt,
          notes: null,
        },
      });

      expect(mockTypeOrmRepo.create).toHaveBeenCalledWith({
        maintenanceCardId: 'card-1',
        doneAtMileage: 12500,
        doneAtDate: doneAt,
        notes: null,
      });
      expect(result).toEqual(newHistory);
    });
  });

  describe('#findByCardId', () => {
    it('returns history records ordered by doneAtDate DESC', async () => {
      const records = [
        {
          id: 'h-2',
          maintenanceCardId: 'card-1',
          doneAtDate: new Date('2026-03-15'),
        },
        {
          id: 'h-1',
          maintenanceCardId: 'card-1',
          doneAtDate: new Date('2026-01-01'),
        },
      ] as MaintenanceHistoryEntity[];

      mockTypeOrmRepo.find.mockResolvedValue(records);

      const result = await repository.findByCardId('card-1');

      expect(mockTypeOrmRepo.find).toHaveBeenCalledWith({
        where: { maintenanceCardId: 'card-1' },
        order: { doneAtDate: 'DESC' },
      });
      expect(result).toEqual(records);
    });
  });
});
