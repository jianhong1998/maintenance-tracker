import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { describe, it, expect } from 'vitest';
import { CreateMaintenanceCardDto } from './create-maintenance-card.dto';

const validPayload = {
  type: 'task',
  name: 'Oil Change',
  intervalMileage: 5000,
};

describe('CreateMaintenanceCardDto', () => {
  it('accepts a valid payload', async () => {
    const dto = plainToInstance(CreateMaintenanceCardDto, validPayload);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  describe('type', () => {
    it('rejects an invalid type value', async () => {
      const dto = plainToInstance(CreateMaintenanceCardDto, {
        ...validPayload,
        type: 'invalid',
      });
      const errors = await validate(dto);
      const typeErrors = errors.find((e) => e.property === 'type');
      expect(typeErrors).toBeDefined();
    });

    it('accepts all valid type values', async () => {
      for (const type of ['task', 'part', 'item']) {
        const dto = plainToInstance(CreateMaintenanceCardDto, {
          ...validPayload,
          type,
        });
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });
  });

  describe('intervalMileage', () => {
    it('rejects a float value', async () => {
      const dto = plainToInstance(CreateMaintenanceCardDto, {
        ...validPayload,
        intervalMileage: 6000.5,
      });
      const errors = await validate(dto);
      const mileageErrors = errors.find(
        (e) => e.property === 'intervalMileage',
      );
      expect(mileageErrors).toBeDefined();
    });

    it('rejects zero', async () => {
      const dto = plainToInstance(CreateMaintenanceCardDto, {
        ...validPayload,
        intervalMileage: 0,
      });
      const errors = await validate(dto);
      const mileageErrors = errors.find(
        (e) => e.property === 'intervalMileage',
      );
      expect(mileageErrors).toBeDefined();
    });

    it('accepts null when intervalTimeMonths is set', async () => {
      const dto = plainToInstance(CreateMaintenanceCardDto, {
        ...validPayload,
        intervalMileage: null,
        intervalTimeMonths: 3,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('intervalTimeMonths', () => {
    it('rejects a float value', async () => {
      const dto = plainToInstance(CreateMaintenanceCardDto, {
        ...validPayload,
        intervalTimeMonths: 3.5,
      });
      const errors = await validate(dto);
      const monthErrors = errors.find(
        (e) => e.property === 'intervalTimeMonths',
      );
      expect(monthErrors).toBeDefined();
    });

    it('rejects zero', async () => {
      const dto = plainToInstance(CreateMaintenanceCardDto, {
        ...validPayload,
        intervalTimeMonths: 0,
      });
      const errors = await validate(dto);
      const monthErrors = errors.find(
        (e) => e.property === 'intervalTimeMonths',
      );
      expect(monthErrors).toBeDefined();
    });

    it('accepts null when intervalMileage is set', async () => {
      const dto = plainToInstance(CreateMaintenanceCardDto, {
        ...validPayload,
        intervalTimeMonths: null,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });
});
