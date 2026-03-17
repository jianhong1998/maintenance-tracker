import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { describe, it, expect } from 'vitest';
import { UpdateVehicleDto } from './update-vehicle.dto';

describe('UpdateVehicleDto', () => {
  describe('mileageUnit', () => {
    it('rejects a numeric value for mileageUnit', async () => {
      const dto = plainToInstance(UpdateVehicleDto, { mileageUnit: 123 });
      const errors = await validate(dto);
      const mileageUnitErrors = errors.find(
        (e) => e.property === 'mileageUnit',
      );
      expect(mileageUnitErrors).toBeDefined();
    });

    it('accepts a valid string mileageUnit', async () => {
      const dto = plainToInstance(UpdateVehicleDto, { mileageUnit: 'km' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('accepts an empty object (all fields optional)', async () => {
      const dto = plainToInstance(UpdateVehicleDto, {});
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });
});
