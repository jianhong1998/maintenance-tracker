import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { VehicleService } from './vehicle.service';
import { VehicleRepository } from '../repositories/vehicle.repository';

const mockVehicleRepository = {
  getAll: vi.fn(),
  getOne: vi.fn(),
  create: vi.fn(),
  updateWithSave: vi.fn(),
  delete: vi.fn(),
};

const userId = 'user-1';
const vehicleId = 'vehicle-1';

const baseVehicle = {
  id: vehicleId,
  userId,
  brand: 'Honda',
  model: 'PCX',
  colour: 'White',
  mileage: 1000,
  mileageUnit: 'km',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

describe('VehicleService', () => {
  let service: VehicleService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VehicleService,
        { provide: VehicleRepository, useValue: mockVehicleRepository },
      ],
    }).compile();

    service = module.get<VehicleService>(VehicleService);
  });

  describe('#listVehicles', () => {
    it('returns all vehicles for the user', async () => {
      mockVehicleRepository.getAll.mockResolvedValue([baseVehicle]);

      const result = await service.listVehicles(userId);

      expect(mockVehicleRepository.getAll).toHaveBeenCalledWith({
        criteria: { userId },
      });
      expect(result).toEqual([baseVehicle]);
    });
  });

  describe('#getVehicle', () => {
    it('returns the vehicle when it belongs to the user', async () => {
      mockVehicleRepository.getOne.mockResolvedValue(baseVehicle);

      const result = await service.getVehicle(vehicleId, userId);

      expect(result).toEqual(baseVehicle);
    });

    it('throws NotFoundException when vehicle not found or does not belong to user', async () => {
      mockVehicleRepository.getOne.mockResolvedValue(null);

      await expect(service.getVehicle(vehicleId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('#createVehicle', () => {
    it('creates and returns a new vehicle', async () => {
      mockVehicleRepository.create.mockResolvedValue(baseVehicle);

      const result = await service.createVehicle(userId, {
        brand: 'Honda',
        model: 'PCX',
        colour: 'White',
        mileage: 1000,
        mileageUnit: 'km',
      });

      expect(mockVehicleRepository.create).toHaveBeenCalledWith({
        creationData: {
          userId,
          brand: 'Honda',
          model: 'PCX',
          colour: 'White',
          mileage: 1000,
          mileageUnit: 'km',
        },
      });
      expect(result).toEqual(baseVehicle);
    });
  });

  describe('#updateVehicle', () => {
    it('updates and returns the vehicle with patched fields applied', async () => {
      const updated = { ...baseVehicle, colour: 'Black' };
      mockVehicleRepository.getOne.mockResolvedValue(baseVehicle);
      mockVehicleRepository.updateWithSave.mockResolvedValue([updated]);

      const result = await service.updateVehicle(vehicleId, userId, {
        colour: 'Black',
      });

      expect(mockVehicleRepository.updateWithSave).toHaveBeenCalledWith({
        dataArray: [expect.objectContaining({ colour: 'Black' })],
      });
      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when vehicle not found', async () => {
      mockVehicleRepository.getOne.mockResolvedValue(null);

      await expect(
        service.updateVehicle(vehicleId, userId, { colour: 'Black' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('#deleteVehicle', () => {
    it('soft deletes the vehicle with cascade to maintenance cards', async () => {
      mockVehicleRepository.getOne.mockResolvedValue(baseVehicle);
      mockVehicleRepository.delete.mockResolvedValue([baseVehicle]);

      await service.deleteVehicle(vehicleId, userId);

      expect(mockVehicleRepository.delete).toHaveBeenCalledWith({
        criteria: { id: vehicleId, userId },
        relation: { maintenanceCards: true },
      });
    });

    it('throws NotFoundException when vehicle not found', async () => {
      mockVehicleRepository.getOne.mockResolvedValue(null);

      await expect(service.deleteVehicle(vehicleId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
