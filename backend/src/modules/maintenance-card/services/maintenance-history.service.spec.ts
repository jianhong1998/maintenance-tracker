import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MaintenanceHistoryService } from './maintenance-history.service';
import { MaintenanceHistoryRepository } from '../repositories/maintenance-history.repository';
import { MaintenanceCardRepository } from '../repositories/maintenance-card.repository';
import { VehicleService } from 'src/modules/vehicle/services/vehicle.service';
import { MILEAGE_UNITS, MAINTENANCE_CARD_TYPES } from '@project/types';

const mockHistoryRepository = {
  findByCardId: vi.fn(),
};

const mockCardRepository = {
  getOneWithDeleted: vi.fn(),
};

const mockVehicleService = {
  getVehicle: vi.fn(),
};

const userId = 'user-1';
const vehicleId = 'vehicle-1';
const cardId = 'card-1';

const baseVehicle = {
  id: vehicleId,
  userId,
  mileage: 10000,
  mileageUnit: MILEAGE_UNITS.KM,
};

const baseCard = {
  id: cardId,
  vehicleId,
  type: MAINTENANCE_CARD_TYPES.TASK,
  name: 'CVT Cleaning',
  description: null,
  intervalMileage: 6000,
  intervalTimeMonths: 6,
  nextDueMileage: null,
  nextDueDate: null,
  deletedAt: null,
};

const baseHistory = [
  {
    id: 'history-2',
    maintenanceCardId: cardId,
    doneAtMileage: 12500,
    doneAtDate: new Date('2026-03-15'),
    notes: null,
    createdAt: new Date(),
  },
  {
    id: 'history-1',
    maintenanceCardId: cardId,
    doneAtMileage: 6000,
    doneAtDate: new Date('2026-01-01'),
    notes: null,
    createdAt: new Date(),
  },
];

describe('MaintenanceHistoryService', () => {
  let service: MaintenanceHistoryService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceHistoryService,
        {
          provide: MaintenanceHistoryRepository,
          useValue: mockHistoryRepository,
        },
        { provide: MaintenanceCardRepository, useValue: mockCardRepository },
        { provide: VehicleService, useValue: mockVehicleService },
      ],
    }).compile();

    service = module.get<MaintenanceHistoryService>(MaintenanceHistoryService);
  });

  describe('#listHistory', () => {
    it('verifies vehicle ownership before fetching history', async () => {
      mockVehicleService.getVehicle.mockResolvedValue(baseVehicle);
      mockCardRepository.getOneWithDeleted.mockResolvedValue(baseCard);
      mockHistoryRepository.findByCardId.mockResolvedValue(baseHistory);

      await service.listHistory(cardId, vehicleId, userId);

      expect(mockVehicleService.getVehicle).toHaveBeenCalledWith(
        vehicleId,
        userId,
      );
    });

    it('fetches card using getOneWithDeleted to support soft-deleted cards', async () => {
      mockVehicleService.getVehicle.mockResolvedValue(baseVehicle);
      mockCardRepository.getOneWithDeleted.mockResolvedValue(baseCard);
      mockHistoryRepository.findByCardId.mockResolvedValue(baseHistory);

      await service.listHistory(cardId, vehicleId, userId);

      expect(mockCardRepository.getOneWithDeleted).toHaveBeenCalledWith({
        criteria: { id: cardId, vehicleId },
      });
    });

    it('throws NotFoundException when card does not exist (even with deleted check)', async () => {
      mockVehicleService.getVehicle.mockResolvedValue(baseVehicle);
      mockCardRepository.getOneWithDeleted.mockResolvedValue(null);
      mockHistoryRepository.findByCardId.mockResolvedValue([]);

      await expect(
        service.listHistory(cardId, vehicleId, userId),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns history records ordered by doneAtDate DESC', async () => {
      mockVehicleService.getVehicle.mockResolvedValue(baseVehicle);
      mockCardRepository.getOneWithDeleted.mockResolvedValue(baseCard);
      mockHistoryRepository.findByCardId.mockResolvedValue(baseHistory);

      const result = await service.listHistory(cardId, vehicleId, userId);

      expect(result).toEqual(baseHistory);
      expect(mockHistoryRepository.findByCardId).toHaveBeenCalledWith(cardId);
    });

    it('throws NotFoundException (via getVehicle) when vehicle does not belong to user', async () => {
      mockVehicleService.getVehicle.mockRejectedValue(new NotFoundException());

      await expect(
        service.listHistory(cardId, vehicleId, userId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
