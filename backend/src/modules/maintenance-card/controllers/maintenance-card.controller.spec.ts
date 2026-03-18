import { Test, TestingModule } from '@nestjs/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MaintenanceCardController } from './maintenance-card.controller';
import { MaintenanceCardService } from '../services/maintenance-card.service';
import { MAINTENANCE_CARD_TYPES } from '@project/types';
import type { IAuthUser } from '@project/types';

const mockMaintenanceCardService = {
  listCards: vi.fn(),
  getCard: vi.fn(),
  createCard: vi.fn(),
  updateCard: vi.fn(),
  deleteCard: vi.fn(),
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
  nextDueDate: new Date('2026-09-01'),
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

describe('MaintenanceCardController', () => {
  let controller: MaintenanceCardController;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MaintenanceCardController],
      providers: [
        {
          provide: MaintenanceCardService,
          useValue: mockMaintenanceCardService,
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

  it('serialises nextDueDate as a date-only string (YYYY-MM-DD)', async () => {
    mockMaintenanceCardService.getCard.mockResolvedValue({
      ...baseCard,
      nextDueDate: new Date('2026-09-01'),
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
});
