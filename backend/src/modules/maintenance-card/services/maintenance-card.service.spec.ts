import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MaintenanceCardService } from './maintenance-card.service';
import { MaintenanceCardRepository } from '../repositories/maintenance-card.repository';
import { MaintenanceHistoryRepository } from '../repositories/maintenance-history.repository';
import { MaintenanceHistoryEntity } from 'src/db/entities/maintenance-history.entity';
import { VehicleService } from 'src/modules/vehicle/services/vehicle.service';
import { MILEAGE_UNITS, MAINTENANCE_CARD_TYPES } from '@project/types';

const mockMaintenanceCardRepository = {
  getAll: vi.fn(),
  getOne: vi.fn(),
  create: vi.fn(),
  updateWithSave: vi.fn(),
  delete: vi.fn(),
};

const mockVehicleService = {
  getVehicle: vi.fn(),
  updateVehicle: vi.fn(),
};

const mockHistoryRepository = {
  create: vi.fn(),
  findByCardId: vi.fn(),
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

const baseHistory = {
  id: 'history-1',
  maintenanceCardId: cardId,
  doneAtMileage: 12500,
  doneAtDate: new Date('2026-03-15'),
  notes: null,
  createdAt: new Date(),
} as MaintenanceHistoryEntity;

const baseCard = {
  id: cardId,
  vehicleId,
  type: MAINTENANCE_CARD_TYPES.TASK,
  name: 'CVT Cleaning',
  description: null,
  intervalMileage: 6000,
  intervalTimeMonths: 6,
  nextDueMileage: 12000,
  nextDueDate: new Date('2026-09-01'),
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

describe('MaintenanceCardService', () => {
  let service: MaintenanceCardService;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockVehicleService.getVehicle.mockResolvedValue(baseVehicle);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceCardService,
        {
          provide: MaintenanceCardRepository,
          useValue: mockMaintenanceCardRepository,
        },
        { provide: VehicleService, useValue: mockVehicleService },
        {
          provide: MaintenanceHistoryRepository,
          useValue: mockHistoryRepository,
        },
      ],
    }).compile();

    service = module.get<MaintenanceCardService>(MaintenanceCardService);
  });

  describe('#listCards', () => {
    it('returns cards sorted by name when sort=name', async () => {
      const cardA = { ...baseCard, id: 'card-a', name: 'Brake Pads' };
      const cardB = { ...baseCard, id: 'card-b', name: 'Air Filter' };
      mockMaintenanceCardRepository.getAll.mockResolvedValue([cardA, cardB]);

      const result = await service.listCards(vehicleId, userId, 'name');

      expect(result[0].name).toBe('Air Filter');
      expect(result[1].name).toBe('Brake Pads');
    });

    it('returns overdue cards first when sort=urgency', async () => {
      const today = new Date();
      const pastDate = new Date(today);
      pastDate.setDate(today.getDate() - 1);
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + 30);

      const overdueCard = {
        ...baseCard,
        id: 'card-overdue',
        name: 'Overdue Task',
        nextDueDate: pastDate,
        nextDueMileage: null,
      };
      const okCard = {
        ...baseCard,
        id: 'card-ok',
        name: 'Fine Task',
        nextDueDate: futureDate,
        nextDueMileage: null,
      };
      mockMaintenanceCardRepository.getAll.mockResolvedValue([
        okCard,
        overdueCard,
      ]);

      const result = await service.listCards(vehicleId, userId, 'urgency');

      expect(result[0].id).toBe('card-overdue');
    });

    it('places mileage-only-overdue cards after date-overdue cards when sort=urgency', async () => {
      const today = new Date();
      const pastDate = new Date(today);
      pastDate.setDate(today.getDate() - 1);

      const dateOverdueCard = {
        ...baseCard,
        id: 'card-date-overdue',
        name: 'Date Overdue',
        nextDueDate: pastDate,
        nextDueMileage: null,
      };
      const mileageOverdueCard = {
        ...baseCard,
        id: 'card-mileage-overdue',
        name: 'Mileage Overdue',
        nextDueDate: null,
        nextDueMileage: 5000, // vehicle mileage is 10000 → overdue
      };
      mockMaintenanceCardRepository.getAll.mockResolvedValue([
        mileageOverdueCard,
        dateOverdueCard,
      ]);

      const result = await service.listCards(vehicleId, userId, 'urgency');

      expect(result[0].id).toBe('card-date-overdue');
      expect(result[1].id).toBe('card-mileage-overdue');
    });

    it('places both-dimension-overdue card in date-overdue group when sort=urgency', async () => {
      const today = new Date();
      const pastDate = new Date(today);
      pastDate.setDate(today.getDate() - 1);

      const bothOverdueCard = {
        ...baseCard,
        id: 'card-both-overdue',
        name: 'Both Overdue',
        nextDueDate: pastDate,
        nextDueMileage: 5000, // vehicle mileage is 10000 → also overdue
      };
      const mileageOnlyCard = {
        ...baseCard,
        id: 'card-mileage-only',
        name: 'Mileage Only Overdue',
        nextDueDate: null,
        nextDueMileage: 5000,
      };
      mockMaintenanceCardRepository.getAll.mockResolvedValue([
        mileageOnlyCard,
        bothOverdueCard,
      ]);

      const result = await service.listCards(vehicleId, userId, 'urgency');

      expect(result[0].id).toBe('card-both-overdue'); // date group first
      expect(result[1].id).toBe('card-mileage-only');
    });

    it('sorts non-overdue cards by nextDueDate ascending when sort=urgency', async () => {
      const today = new Date();
      const near = new Date(today);
      near.setDate(today.getDate() + 10);
      const far = new Date(today);
      far.setDate(today.getDate() + 60);

      const nearCard = {
        ...baseCard,
        id: 'card-near',
        name: 'Near Due',
        nextDueDate: near,
        nextDueMileage: null,
      };
      const farCard = {
        ...baseCard,
        id: 'card-far',
        name: 'Far Due',
        nextDueDate: far,
        nextDueMileage: null,
      };
      mockMaintenanceCardRepository.getAll.mockResolvedValue([
        farCard,
        nearCard,
      ]);

      const result = await service.listCards(vehicleId, userId, 'urgency');

      expect(result[0].id).toBe('card-near');
      expect(result[1].id).toBe('card-far');
    });

    it('treats nextDueMileage equal to vehicle mileage as overdue', async () => {
      const today = new Date();
      const future = new Date(today);
      future.setDate(today.getDate() + 30);

      // baseVehicle.mileage = 10000
      const exactMileageCard = {
        ...baseCard,
        id: 'card-exact',
        name: 'At Exact Mileage',
        nextDueDate: null,
        nextDueMileage: 10000, // == vehicle mileage, should be overdue
      };
      const futureCard = {
        ...baseCard,
        id: 'card-future',
        name: 'Future Task',
        nextDueDate: future,
        nextDueMileage: null,
      };
      mockMaintenanceCardRepository.getAll.mockResolvedValue([
        futureCard,
        exactMileageCard,
      ]);

      const result = await service.listCards(vehicleId, userId, 'urgency');

      expect(result[0].id).toBe('card-exact');
      expect(result[1].id).toBe('card-future');
    });

    it('places cards with no due info last when sort=urgency', async () => {
      const today = new Date();
      const future = new Date(today);
      future.setDate(today.getDate() + 30);

      const noDueCard = {
        ...baseCard,
        id: 'card-no-due',
        name: 'No Due Info',
        nextDueDate: null,
        nextDueMileage: null,
      };
      const normalCard = {
        ...baseCard,
        id: 'card-normal',
        name: 'Has Due Date',
        nextDueDate: future,
        nextDueMileage: null,
      };
      mockMaintenanceCardRepository.getAll.mockResolvedValue([
        noDueCard,
        normalCard,
      ]);

      const result = await service.listCards(vehicleId, userId, 'urgency');

      expect(result[result.length - 1].id).toBe('card-no-due');
    });

    it('verifies vehicle ownership by calling VehicleService.getVehicle', async () => {
      mockMaintenanceCardRepository.getAll.mockResolvedValue([]);

      await service.listCards(vehicleId, userId, 'name');

      expect(mockVehicleService.getVehicle).toHaveBeenCalledWith(
        vehicleId,
        userId,
      );
    });

    it('throws NotFoundException when vehicle does not exist', async () => {
      mockVehicleService.getVehicle.mockRejectedValue(new NotFoundException());

      await expect(
        service.listCards(vehicleId, userId, 'name'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('#getCard', () => {
    it('returns the card when it belongs to the vehicle', async () => {
      mockMaintenanceCardRepository.getOne.mockResolvedValue(baseCard);

      const result = await service.getCard(cardId, vehicleId, userId);

      expect(result).toEqual(baseCard);
    });

    it('throws NotFoundException when card not found', async () => {
      mockMaintenanceCardRepository.getOne.mockResolvedValue(null);

      await expect(service.getCard(cardId, vehicleId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('#createCard', () => {
    it('creates a card for the verified vehicle', async () => {
      mockMaintenanceCardRepository.create.mockResolvedValue(baseCard);

      const result = await service.createCard(vehicleId, userId, {
        type: MAINTENANCE_CARD_TYPES.TASK,
        name: 'CVT Cleaning',
        description: null,
        intervalMileage: 6000,
        intervalTimeMonths: 6,
      });

      expect(result).toEqual(baseCard);
    });

    it('throws BadRequestException when both intervalMileage and intervalTimeMonths are null', async () => {
      await expect(
        service.createCard(vehicleId, userId, {
          type: MAINTENANCE_CARD_TYPES.TASK,
          name: 'CVT Cleaning',
          description: null,
          intervalMileage: null,
          intervalTimeMonths: null,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('#updateCard', () => {
    it('updates and returns the card with patched fields applied', async () => {
      const updated = { ...baseCard, name: 'Updated Name' };
      mockMaintenanceCardRepository.getOne.mockResolvedValue(baseCard);
      mockMaintenanceCardRepository.updateWithSave.mockResolvedValue([updated]);

      const result = await service.updateCard(cardId, vehicleId, userId, {
        name: 'Updated Name',
      });

      expect(mockMaintenanceCardRepository.updateWithSave).toHaveBeenCalledWith(
        {
          dataArray: [expect.objectContaining({ name: 'Updated Name' })],
        },
      );
      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when card not found', async () => {
      mockMaintenanceCardRepository.getOne.mockResolvedValue(null);

      await expect(
        service.updateCard(cardId, vehicleId, userId, { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('preserves existing fields when input has undefined values (class-transformer ES2023 behaviour)', async () => {
      mockMaintenanceCardRepository.getOne.mockResolvedValue(baseCard);
      mockMaintenanceCardRepository.updateWithSave.mockResolvedValue([
        { ...baseCard, name: 'New Name' },
      ]);

      // Simulate what class-transformer produces: all DTO class fields are own properties,
      // those absent from the request JSON are undefined but still enumerable.
      await service.updateCard(cardId, vehicleId, userId, {
        name: 'New Name',
        intervalMileage: undefined,
        intervalTimeMonths: undefined,
      });

      expect(mockMaintenanceCardRepository.updateWithSave).toHaveBeenCalledWith(
        {
          dataArray: [
            expect.objectContaining({
              intervalMileage: baseCard.intervalMileage,
              intervalTimeMonths: baseCard.intervalTimeMonths,
            }),
          ],
        },
      );
    });

    it('throws BadRequestException when update would nullify both intervals', async () => {
      const cardWithBothIntervals = {
        ...baseCard,
        intervalMileage: 6000,
        intervalTimeMonths: 6,
      };
      mockMaintenanceCardRepository.getOne.mockResolvedValue(
        cardWithBothIntervals,
      );

      await expect(
        service.updateCard(cardId, vehicleId, userId, {
          intervalMileage: null,
          intervalTimeMonths: null,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('#deleteCard', () => {
    it('soft deletes the card', async () => {
      mockMaintenanceCardRepository.getOne.mockResolvedValue(baseCard);
      mockMaintenanceCardRepository.delete.mockResolvedValue([baseCard]);

      await service.deleteCard(cardId, vehicleId, userId);

      expect(mockMaintenanceCardRepository.delete).toHaveBeenCalledWith({
        entities: [baseCard],
      });
    });

    it('throws NotFoundException when card not found', async () => {
      mockMaintenanceCardRepository.getOne.mockResolvedValue(null);

      await expect(
        service.deleteCard(cardId, vehicleId, userId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('#markDone', () => {
    beforeEach(() => {
      mockMaintenanceCardRepository.getOne.mockResolvedValue({
        ...baseCard,
        intervalMileage: 6000,
        intervalTimeMonths: 6,
        nextDueMileage: null,
        nextDueDate: null,
      });
      mockHistoryRepository.create.mockResolvedValue(baseHistory);
      mockMaintenanceCardRepository.updateWithSave.mockImplementation(
        ({ dataArray }) => Promise.resolve(dataArray),
      );
      mockVehicleService.updateVehicle.mockResolvedValue({
        ...baseVehicle,
        mileage: 12500,
      });
    });

    it('creates a history record with server-side today as doneAtDate', async () => {
      const before = new Date();
      await service.markDone(cardId, vehicleId, userId, {
        doneAtMileage: 12500,
      });
      const after = new Date();

      const call = mockHistoryRepository.create.mock.calls[0]?.[0] as {
        creationData: {
          maintenanceCardId: string;
          doneAtMileage: number;
          doneAtDate: Date;
          notes: string | null;
        };
      };
      expect(call.creationData.maintenanceCardId).toBe(cardId);
      expect(call.creationData.doneAtMileage).toBe(12500);
      expect(call.creationData.doneAtDate.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(call.creationData.doneAtDate.getTime()).toBeLessThanOrEqual(
        after.getTime(),
      );
      expect(call.creationData.notes).toBeNull();
    });

    it('resets nextDueMileage when intervalMileage is set', async () => {
      await service.markDone(cardId, vehicleId, userId, {
        doneAtMileage: 12500,
      });

      const savedCard = (
        mockMaintenanceCardRepository.updateWithSave.mock.calls[0]?.[0] as {
          dataArray: Array<{ nextDueMileage: number }>;
        }
      ).dataArray[0];
      expect(savedCard.nextDueMileage).toBe(18500); // 12500 + 6000
    });

    it('resets nextDueDate when intervalTimeMonths is set', async () => {
      await service.markDone(cardId, vehicleId, userId, {
        doneAtMileage: 12500,
      });

      const savedCard = (
        mockMaintenanceCardRepository.updateWithSave.mock.calls[0]?.[0] as {
          dataArray: Array<{ nextDueDate: Date | null }>;
        }
      ).dataArray[0];
      expect(savedCard.nextDueDate).toBeDefined();
      expect(savedCard.nextDueDate).not.toBeNull();
    });

    it('auto-updates vehicle mileage when doneAtMileage > vehicle.mileage', async () => {
      await service.markDone(cardId, vehicleId, userId, {
        doneAtMileage: 12500,
      });

      expect(mockVehicleService.updateVehicle).toHaveBeenCalledWith(
        vehicleId,
        userId,
        {
          mileage: 12500,
        },
      );
    });

    it('does NOT update vehicle mileage when doneAtMileage <= vehicle.mileage', async () => {
      await service.markDone(cardId, vehicleId, userId, {
        doneAtMileage: 9000,
      });

      expect(mockVehicleService.updateVehicle).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when card has intervalMileage but doneAtMileage is not provided', async () => {
      await expect(
        service.markDone(cardId, vehicleId, userId, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('succeeds for a time-only card when doneAtMileage is not provided', async () => {
      mockMaintenanceCardRepository.getOne.mockResolvedValue({
        ...baseCard,
        intervalMileage: null,
        intervalTimeMonths: 6,
        nextDueMileage: null,
        nextDueDate: null,
      });

      const result = await service.markDone(cardId, vehicleId, userId, {});

      expect(result).toEqual(baseHistory);
      expect(mockVehicleService.updateVehicle).not.toHaveBeenCalled();
      const call = mockHistoryRepository.create.mock.calls[0]?.[0] as {
        creationData: { doneAtMileage: number | null };
      };
      expect(call.creationData.doneAtMileage).toBeNull();
    });

    it('passes notes through to the history record', async () => {
      await service.markDone(cardId, vehicleId, userId, {
        doneAtMileage: 12500,
        notes: 'replaced oil filter too',
      });

      const call = mockHistoryRepository.create.mock.calls[0]?.[0] as {
        creationData: { notes: string | null };
      };
      expect(call.creationData.notes).toBe('replaced oil filter too');
    });

    it('returns the created history record', async () => {
      const result = await service.markDone(cardId, vehicleId, userId, {
        doneAtMileage: 12500,
      });
      expect(result).toEqual(baseHistory);
    });
  });
});
