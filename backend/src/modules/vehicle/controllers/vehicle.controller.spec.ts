import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { VehicleController } from './vehicle.controller';
import { VehicleService } from '../services/vehicle.service';
import { IAuthUser } from '@project/types';

const mockVehicleService = {
  listVehicles: vi.fn(),
  getVehicle: vi.fn(),
  createVehicle: vi.fn(),
  updateVehicle: vi.fn(),
  deleteVehicle: vi.fn(),
};

const authUser: IAuthUser = {
  id: 'user-1',
  email: 'user@example.com',
  firebaseUid: 'uid-1',
};

const baseVehicle = {
  id: 'vehicle-1',
  userId: 'user-1',
  brand: 'Honda',
  model: 'PCX',
  colour: 'White',
  mileage: 1000,
  mileageUnit: 'km',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

describe('VehicleController', () => {
  let controller: VehicleController;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VehicleController],
      providers: [{ provide: VehicleService, useValue: mockVehicleService }],
    }).compile();

    controller = module.get<VehicleController>(VehicleController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('GET /vehicles returns list', async () => {
    mockVehicleService.listVehicles.mockResolvedValue([baseVehicle]);
    const result = await controller.list(authUser);
    expect(result).toHaveLength(1);
    expect(mockVehicleService.listVehicles).toHaveBeenCalledWith(authUser.id);
    // Verify toResDTO maps dates to ISO strings
    expect(typeof result[0].createdAt).toBe('string');
    expect(typeof result[0].updatedAt).toBe('string');
  });

  it('GET /vehicles/:id returns vehicle with ISO date strings', async () => {
    mockVehicleService.getVehicle.mockResolvedValue(baseVehicle);
    const result = await controller.getOne('vehicle-1', authUser);
    expect(result.id).toBe('vehicle-1');
    expect(typeof result.createdAt).toBe('string');
    expect(typeof result.updatedAt).toBe('string');
  });

  it('GET /vehicles/:id throws 404 for wrong user', async () => {
    mockVehicleService.getVehicle.mockRejectedValue(new NotFoundException());
    await expect(controller.getOne('vehicle-1', authUser)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('POST /vehicles creates vehicle', async () => {
    mockVehicleService.createVehicle.mockResolvedValue(baseVehicle);
    const result = await controller.create(
      {
        brand: 'Honda',
        model: 'PCX',
        colour: 'White',
        mileage: 1000,
        mileageUnit: 'km',
      },
      authUser,
    );
    expect(result.id).toBe('vehicle-1');
  });

  it('PATCH /vehicles/:id updates vehicle', async () => {
    const updated = { ...baseVehicle, colour: 'Black' };
    mockVehicleService.updateVehicle.mockResolvedValue(updated);
    const result = await controller.update(
      'vehicle-1',
      { colour: 'Black' },
      authUser,
    );
    expect(result.colour).toBe('Black');
  });

  it('DELETE /vehicles/:id returns 204', async () => {
    mockVehicleService.deleteVehicle.mockResolvedValue(undefined);
    await expect(
      controller.delete('vehicle-1', authUser),
    ).resolves.toBeUndefined();
  });
});
