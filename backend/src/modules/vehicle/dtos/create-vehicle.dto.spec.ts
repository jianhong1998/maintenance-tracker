import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { describe, it, expect } from 'vitest';
import { CreateVehicleDto } from './create-vehicle.dto';

const validPayload = {
  brand: 'Honda',
  model: 'PCX',
  colour: 'White',
  mileage: 1000,
  mileageUnit: 'km',
};

describe('CreateVehicleDto', () => {
  describe('mileageUnit', () => {
    it('rejects a numeric value for mileageUnit', async () => {
      const dto = plainToInstance(CreateVehicleDto, {
        ...validPayload,
        mileageUnit: 123,
      });
      const errors = await validate(dto);
      const mileageUnitErrors = errors.find(
        (e) => e.property === 'mileageUnit',
      );
      expect(mileageUnitErrors).toBeDefined();
    });

    it('accepts a valid string mileageUnit', async () => {
      const dto = plainToInstance(CreateVehicleDto, validPayload);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });
});
