import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { VehicleRepository } from './vehicle.repository';
import { VehicleEntity, MileageUnit } from 'src/db/entities/vehicle.entity';

const mockTypeOrmRepo = {
  create: vi.fn(),
  save: vi.fn(),
};

describe('VehicleRepository', () => {
  let repository: VehicleRepository;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VehicleRepository,
        {
          provide: getRepositoryToken(VehicleEntity),
          useValue: mockTypeOrmRepo,
        },
      ],
    }).compile();

    repository = module.get<VehicleRepository>(VehicleRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('#create', () => {
    it('creates and saves a new vehicle', async () => {
      const newVehicle = {
        id: 'vehicle-1',
        userId: 'user-1',
        brand: 'Honda',
        model: 'PCX',
        colour: 'White',
        mileage: 1000,
        mileageUnit: MileageUnit.KM,
      } as VehicleEntity;

      mockTypeOrmRepo.create.mockReturnValue(newVehicle);
      mockTypeOrmRepo.save.mockResolvedValue(newVehicle);

      const result = await repository.create({
        creationData: {
          userId: 'user-1',
          brand: 'Honda',
          model: 'PCX',
          colour: 'White',
          mileage: 1000,
          mileageUnit: MileageUnit.KM,
        },
      });

      expect(mockTypeOrmRepo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        brand: 'Honda',
        model: 'PCX',
        colour: 'White',
        mileage: 1000,
        mileageUnit: MileageUnit.KM,
      });
      expect(mockTypeOrmRepo.save).toHaveBeenCalledWith(newVehicle);
      expect(result).toEqual(newVehicle);
    });
  });
});
