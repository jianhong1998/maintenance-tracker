import { Test, TestingModule } from '@nestjs/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MaintenanceCardController } from './maintenance-card.controller';
import { MaintenanceCardService } from '../services/maintenance-card.service';
import { MaintenanceHistoryService } from '../services/maintenance-history.service';
import { MAINTENANCE_CARD_TYPES } from '@project/types';
import type { IAuthUser } from '@project/types';

const mockMaintenanceCardService = {
  listCards: vi.fn(),
  getCard: vi.fn(),
  createCard: vi.fn(),
  updateCard: vi.fn(),
  deleteCard: vi.fn(),
  markDone: vi.fn(),
};

const authUser: IAuthUser = {
  id: 'user-1',
  email: 'user@example.com',
  firebaseUid: 'uid-1',
};

const baseCard = {
  id: 'card-1',
  vehicleId: 'vehicle-1',
  type: MAINTENANCE_CARD_TYPES.TASK,
  name: 'CVT Cleaning',
  description: null,
  intervalMileage: 6000,
  intervalTimeMonths: 6,
  nextDueMileage: 12000,
  nextDueDate: new Date('2026-09-01T00:00:00'),
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const baseHistory = {
  id: 'history-1',
  maintenanceCardId: 'card-1',
  doneAtMileage: 12500,
  doneAtDate: new Date('2026-03-15T00:00:00'),
  notes: null,
  createdAt: new Date(),
};

describe('MaintenanceCardController', () => {
  let controller: MaintenanceCardController;

  const mockMaintenanceHistoryService = {
    listHistory: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MaintenanceCardController],
      providers: [
        {
          provide: MaintenanceCardService,
          useValue: mockMaintenanceCardService,
        },
        {
          provide: MaintenanceHistoryService,
          useValue: mockMaintenanceHistoryService,
        },
      ],
    }).compile();

    controller = module.get<MaintenanceCardController>(
      MaintenanceCardController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('GET /vehicles/:vehicleId/maintenance-cards returns list', async () => {
    mockMaintenanceCardService.listCards.mockResolvedValue([baseCard]);
    const result = await controller.list('vehicle-1', 'name', authUser);
    expect(result).toHaveLength(1);
    expect(typeof result[0].createdAt).toBe('string');
    expect(typeof result[0].updatedAt).toBe('string');
  });

  it('GET /vehicles/:vehicleId/maintenance-cards/:id returns single card', async () => {
    mockMaintenanceCardService.getCard.mockResolvedValue(baseCard);
    const result = await controller.getOne('vehicle-1', 'card-1', authUser);
    expect(result.id).toBe('card-1');
    expect(typeof result.createdAt).toBe('string');
  });

  it('POST /vehicles/:vehicleId/maintenance-cards creates card', async () => {
    mockMaintenanceCardService.createCard.mockResolvedValue(baseCard);
    const result = await controller.create(
      'vehicle-1',
      {
        type: 'task',
        name: 'CVT Cleaning',
        intervalMileage: 6000,
        intervalTimeMonths: 6,
      },
      authUser,
    );
    expect(result.id).toBe('card-1');
  });

  it('PATCH /vehicles/:vehicleId/maintenance-cards/:id updates card', async () => {
    const updated = { ...baseCard, name: 'Updated' };
    mockMaintenanceCardService.updateCard.mockResolvedValue(updated);
    const result = await controller.update(
      'vehicle-1',
      'card-1',
      { name: 'Updated' },
      authUser,
    );
    expect(result.name).toBe('Updated');
  });

  it('serialises nextDueDate as a local date-only string (YYYY-MM-DD), not UTC', async () => {
    // dateTransformer produces local-time Dates (new Date('…T00:00:00'), no Z).
    // formatLocalDate must use local getters (getDate etc.) so UTC conversion
    // via toISOString() cannot shift the date by the server's UTC offset.
    mockMaintenanceCardService.getCard.mockResolvedValue({
      ...baseCard,
      nextDueDate: new Date('2026-09-01T00:00:00'),
    });
    const result = await controller.getOne('vehicle-1', 'card-1', authUser);
    expect(result.nextDueDate).toBe('2026-09-01');
  });

  it('DELETE /vehicles/:vehicleId/maintenance-cards/:id returns 204', async () => {
    mockMaintenanceCardService.deleteCard.mockResolvedValue(undefined);
    await expect(
      controller.delete('vehicle-1', 'card-1', authUser),
    ).resolves.toBeUndefined();
  });

  it('POST /vehicles/:vehicleId/maintenance-cards/:id/mark-done returns 201 with history DTO', async () => {
    mockMaintenanceCardService.markDone.mockResolvedValue(baseHistory);

    const result = await controller.markDone(
      'vehicle-1',
      'card-1',
      { doneAtMileage: 12500, notes: null },
      authUser,
    );

    expect(mockMaintenanceCardService.markDone).toHaveBeenCalledWith(
      'card-1',
      'vehicle-1',
      authUser.id,
      { doneAtMileage: 12500, notes: null },
    );
    expect(result.id).toBe('history-1');
    expect(typeof result.doneAtDate).toBe('string');
    expect(typeof result.createdAt).toBe('string');
  });

  it('GET /vehicles/:vehicleId/maintenance-cards/:id/history returns history list', async () => {
    mockMaintenanceHistoryService.listHistory.mockResolvedValue([baseHistory]);

    const result = await controller.listHistory(
      'vehicle-1',
      'card-1',
      authUser,
    );

    expect(mockMaintenanceHistoryService.listHistory).toHaveBeenCalledWith(
      'card-1',
      'vehicle-1',
      authUser.id,
    );
    expect(result).toHaveLength(1);
    expect(typeof result[0].doneAtDate).toBe('string');
    expect(typeof result[0].createdAt).toBe('string');
  });
});
