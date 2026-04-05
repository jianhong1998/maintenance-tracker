import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
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
  mileageLastUpdatedAt: null,
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

    it('throws BadRequestException when input.mileage is less than current vehicle mileage', async () => {
      mockVehicleRepository.getOne.mockResolvedValue(baseVehicle);

      await expect(
        service.updateVehicle(vehicleId, userId, { mileage: 999 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('does not throw when input.mileage equals current vehicle mileage', async () => {
      const updated = { ...baseVehicle };
      mockVehicleRepository.getOne.mockResolvedValue(baseVehicle);
      mockVehicleRepository.updateWithSave.mockResolvedValue([updated]);

      await expect(
        service.updateVehicle(vehicleId, userId, { mileage: 1000 }),
      ).resolves.not.toThrow();
    });
  });

  describe('#recordMileage', () => {
    it('updates mileage and sets mileageLastUpdatedAt', async () => {
      const now = new Date('2026-04-05T10:00:00Z');
      vi.setSystemTime(now);

      const updated = {
        ...baseVehicle,
        mileage: 1500,
        mileageLastUpdatedAt: now,
      };
      mockVehicleRepository.getOne.mockResolvedValue({ ...baseVehicle });
      mockVehicleRepository.updateWithSave.mockResolvedValue([updated]);

      const result = await service.recordMileage({
        id: vehicleId,
        userId,
        mileage: 1500,
      });

      expect(mockVehicleRepository.updateWithSave).toHaveBeenCalledWith({
        dataArray: [
          expect.objectContaining({
            mileage: 1500,
            mileageLastUpdatedAt: now,
          }),
        ],
      });
      expect(result).toEqual(updated);

      vi.useRealTimers();
    });

    it('sets mileageLastUpdatedAt even when mileage equals current value', async () => {
      const now = new Date('2026-04-05T10:00:00Z');
      vi.setSystemTime(now);

      const updated = { ...baseVehicle, mileageLastUpdatedAt: now };
      mockVehicleRepository.getOne.mockResolvedValue({ ...baseVehicle });
      mockVehicleRepository.updateWithSave.mockResolvedValue([updated]);

      await service.recordMileage({ id: vehicleId, userId, mileage: 1000 });

      expect(mockVehicleRepository.updateWithSave).toHaveBeenCalledWith({
        dataArray: [expect.objectContaining({ mileageLastUpdatedAt: now })],
      });

      vi.useRealTimers();
    });

    it('throws NotFoundException when vehicle not found', async () => {
      mockVehicleRepository.getOne.mockResolvedValue(null);

      await expect(
        service.recordMileage({ id: vehicleId, userId, mileage: 1500 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when mileage is below current vehicle mileage', async () => {
      mockVehicleRepository.getOne.mockResolvedValue({ ...baseVehicle });

      await expect(
        service.recordMileage({ id: vehicleId, userId, mileage: 999 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('#deleteVehicle', () => {
    it('soft deletes the vehicle with cascade to maintenance cards', async () => {
      mockVehicleRepository.delete.mockResolvedValue([baseVehicle]);

      await service.deleteVehicle(vehicleId, userId);

      expect(mockVehicleRepository.delete).toHaveBeenCalledWith({
        criteria: { id: vehicleId, userId },
        relation: { maintenanceCards: true },
      });
    });

    it('throws NotFoundException when vehicle not found', async () => {
      mockVehicleRepository.delete.mockResolvedValue(null);

      await expect(service.deleteVehicle(vehicleId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
