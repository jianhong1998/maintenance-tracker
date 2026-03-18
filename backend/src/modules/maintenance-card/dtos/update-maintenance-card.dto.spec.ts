import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { describe, it, expect } from 'vitest';
import { UpdateMaintenanceCardDto } from './update-maintenance-card.dto';

describe('UpdateMaintenanceCardDto', () => {
  it('accepts an empty object (all fields optional)', async () => {
    const dto = plainToInstance(UpdateMaintenanceCardDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  describe('type', () => {
    it('rejects an invalid type value', async () => {
      const dto = plainToInstance(UpdateMaintenanceCardDto, {
        type: 'invalid',
      });
      const errors = await validate(dto);
      const typeErrors = errors.find((e) => e.property === 'type');
      expect(typeErrors).toBeDefined();
    });

    it('accepts all valid type values', async () => {
      for (const type of ['task', 'part', 'item']) {
        const dto = plainToInstance(UpdateMaintenanceCardDto, { type });
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });
  });

  describe('intervalMileage', () => {
    it('rejects a float value', async () => {
      const dto = plainToInstance(UpdateMaintenanceCardDto, {
        intervalMileage: 6000.5,
      });
      const errors = await validate(dto);
      const mileageErrors = errors.find(
        (e) => e.property === 'intervalMileage',
      );
      expect(mileageErrors).toBeDefined();
    });

    it('rejects zero', async () => {
      const dto = plainToInstance(UpdateMaintenanceCardDto, {
        intervalMileage: 0,
      });
      const errors = await validate(dto);
      const mileageErrors = errors.find(
        (e) => e.property === 'intervalMileage',
      );
      expect(mileageErrors).toBeDefined();
    });

    it('accepts null to clear the field', async () => {
      const dto = plainToInstance(UpdateMaintenanceCardDto, {
        intervalMileage: null,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('intervalTimeMonths', () => {
    it('rejects a float value', async () => {
      const dto = plainToInstance(UpdateMaintenanceCardDto, {
        intervalTimeMonths: 3.5,
      });
      const errors = await validate(dto);
      const monthErrors = errors.find(
        (e) => e.property === 'intervalTimeMonths',
      );
      expect(monthErrors).toBeDefined();
    });

    it('rejects zero', async () => {
      const dto = plainToInstance(UpdateMaintenanceCardDto, {
        intervalTimeMonths: 0,
      });
      const errors = await validate(dto);
      const monthErrors = errors.find(
        (e) => e.property === 'intervalTimeMonths',
      );
      expect(monthErrors).toBeDefined();
    });

    it('accepts null to clear the field', async () => {
      const dto = plainToInstance(UpdateMaintenanceCardDto, {
        intervalTimeMonths: null,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });
});
