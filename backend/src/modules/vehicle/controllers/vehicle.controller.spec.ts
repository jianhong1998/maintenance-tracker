import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, NotFoundException } from '@nestjs/common';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { VehicleController } from './vehicle.controller';
import { VehicleService } from '../services/vehicle.service';
import type { IAuthUser } from '@project/types';

const mockVehicleService = {
  listVehicles: vi.fn(),
  getVehicle: vi.fn(),
  createVehicle: vi.fn(),
  updateVehicle: vi.fn(),
  deleteVehicle: vi.fn(),
  recordMileage: vi.fn(),
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
  mileageLastUpdatedAt: null,
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
    expect(typeof result[0].createdAt).toBe('string');
    expect(typeof result[0].updatedAt).toBe('string');
    expect(result[0].mileageLastUpdatedAt).toBeNull();
  });

  it('GET /vehicles/:id returns vehicle with ISO date strings', async () => {
    const vehicleWithTimestamp = {
      ...baseVehicle,
      mileageLastUpdatedAt: new Date('2026-04-05T10:00:00Z'),
    };
    mockVehicleService.getVehicle.mockResolvedValue(vehicleWithTimestamp);
    const result = await controller.getOne('vehicle-1', authUser);
    expect(result.id).toBe('vehicle-1');
    expect(typeof result.createdAt).toBe('string');
    expect(typeof result.updatedAt).toBe('string');
    expect(result.mileageLastUpdatedAt).toBe('2026-04-05T10:00:00.000Z');
  });

  it('GET /vehicles/:id throws 404 for wrong user', async () => {
    mockVehicleService.getVehicle.mockRejectedValue(new NotFoundException());
    await expect(controller.getOne('vehicle-1', authUser)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('POST /vehicles create handler has HTTP 201 status code', () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const createFn = VehicleController.prototype.create;
    const httpCode = Reflect.getMetadata('__httpCode__', createFn) as
      | number
      | undefined;
    expect(httpCode).toBe(HttpStatus.CREATED);
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

  it('PATCH /vehicles/:id/mileage records mileage and returns updated vehicle', async () => {
    const updated = {
      ...baseVehicle,
      mileage: 2000,
      mileageLastUpdatedAt: new Date('2026-04-05T10:00:00Z'),
    };
    mockVehicleService.recordMileage.mockResolvedValue(updated);

    const result = await controller.recordMileage(
      'vehicle-1',
      { mileage: 2000 },
      authUser,
    );

    expect(mockVehicleService.recordMileage).toHaveBeenCalledWith({
      id: 'vehicle-1',
      userId: authUser.id,
      mileage: 2000,
    });
    expect(result.mileage).toBe(2000);
    expect(result.mileageLastUpdatedAt).toBe('2026-04-05T10:00:00.000Z');
  });
});
