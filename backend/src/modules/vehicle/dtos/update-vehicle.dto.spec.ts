import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { describe, it, expect } from 'vitest';
import { UpdateVehicleDto } from './update-vehicle.dto';

describe('UpdateVehicleDto', () => {
  it('accepts an empty object (all fields optional)', async () => {
    const dto = plainToInstance(UpdateVehicleDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  describe('mileageUnit', () => {
    it('rejects a numeric value for mileageUnit', async () => {
      const dto = plainToInstance(UpdateVehicleDto, { mileageUnit: 123 });
      const errors = await validate(dto);
      const mileageUnitErrors = errors.find(
        (e) => e.property === 'mileageUnit',
      );
      expect(mileageUnitErrors).toBeDefined();
    });

    it('rejects an invalid string mileageUnit', async () => {
      const dto = plainToInstance(UpdateVehicleDto, { mileageUnit: 'gallons' });
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
  });

  describe('mileage', () => {
    it('rejects a negative mileage', async () => {
      const dto = plainToInstance(UpdateVehicleDto, { mileage: -1 });
      const errors = await validate(dto);
      const mileageErrors = errors.find((e) => e.property === 'mileage');
      expect(mileageErrors).toBeDefined();
    });

    it('rejects a value above 1_000_000', async () => {
      const dto = plainToInstance(UpdateVehicleDto, { mileage: 1_000_001 });
      const errors = await validate(dto);
      const mileageErrors = errors.find((e) => e.property === 'mileage');
      expect(mileageErrors).toBeDefined();
    });

    it('accepts zero mileage', async () => {
      const dto = plainToInstance(UpdateVehicleDto, { mileage: 0 });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('brand', () => {
    it('rejects an empty string brand', async () => {
      const dto = plainToInstance(UpdateVehicleDto, { brand: '' });
      const errors = await validate(dto);
      const brandErrors = errors.find((e) => e.property === 'brand');
      expect(brandErrors).toBeDefined();
    });
  });

  describe('model', () => {
    it('rejects an empty string model', async () => {
      const dto = plainToInstance(UpdateVehicleDto, { model: '' });
      const errors = await validate(dto);
      const modelErrors = errors.find((e) => e.property === 'model');
      expect(modelErrors).toBeDefined();
    });
  });

  describe('colour', () => {
    it('rejects an empty string colour', async () => {
      const dto = plainToInstance(UpdateVehicleDto, { colour: '' });
      const errors = await validate(dto);
      const colourErrors = errors.find((e) => e.property === 'colour');
      expect(colourErrors).toBeDefined();
    });
  });
});
