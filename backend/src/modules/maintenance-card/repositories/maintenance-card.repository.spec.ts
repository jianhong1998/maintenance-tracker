import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MaintenanceCardRepository } from './maintenance-card.repository';
import { MaintenanceCardEntity } from 'src/db/entities/maintenance-card.entity';
import { MAINTENANCE_CARD_TYPES } from '@project/types';

const mockTypeOrmRepo = {
  create: vi.fn(),
  save: vi.fn(),
  findOne: vi.fn(),
};

describe('MaintenanceCardRepository', () => {
  let repository: MaintenanceCardRepository;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceCardRepository,
        {
          provide: getRepositoryToken(MaintenanceCardEntity),
          useValue: mockTypeOrmRepo,
        },
      ],
    }).compile();

    repository = module.get<MaintenanceCardRepository>(
      MaintenanceCardRepository,
    );
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('#create', () => {
    it('creates and saves a new maintenance card', async () => {
      const newCard = {
        id: 'card-1',
        vehicleId: 'vehicle-1',
        type: MAINTENANCE_CARD_TYPES.TASK,
        name: 'CVT Cleaning',
        description: null,
        intervalMileage: 6000,
        intervalTimeMonths: 6,
        nextDueMileage: null,
        nextDueDate: null,
      } as MaintenanceCardEntity;

      mockTypeOrmRepo.create.mockReturnValue(newCard);
      mockTypeOrmRepo.save.mockResolvedValue(newCard);

      const result = await repository.create({
        creationData: {
          vehicleId: 'vehicle-1',
          type: MAINTENANCE_CARD_TYPES.TASK,
          name: 'CVT Cleaning',
          description: null,
          intervalMileage: 6000,
          intervalTimeMonths: 6,
        },
      });

      expect(result).toEqual(newCard);
    });
  });

  describe('#getOneWithDeleted', () => {
    it('calls findOne with withDeleted: true', async () => {
      const card = { id: 'card-1', vehicleId: 'vehicle-1' };
      mockTypeOrmRepo.findOne.mockResolvedValue(card);

      const result = await repository.getOneWithDeleted({
        criteria: { id: 'card-1', vehicleId: 'vehicle-1' },
      });

      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'card-1', vehicleId: 'vehicle-1' },
        withDeleted: true,
      });
      expect(result).toEqual(card);
    });

    it('returns null when card not found', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repository.getOneWithDeleted({
        criteria: { id: 'card-1', vehicleId: 'vehicle-1' },
      });

      expect(result).toBeNull();
    });
  });
});
