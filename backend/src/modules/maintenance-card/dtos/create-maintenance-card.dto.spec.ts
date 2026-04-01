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

    it('rejects a value above 1_000_000', async () => {
      const dto = plainToInstance(CreateMaintenanceCardDto, {
        ...validPayload,
        intervalMileage: 1_000_001,
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

  describe('nextDueMileage', () => {
    it('accepts a positive integer', async () => {
      const dto = plainToInstance(CreateMaintenanceCardDto, {
        ...validPayload,
        nextDueMileage: 15000,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects a float value', async () => {
      const dto = plainToInstance(CreateMaintenanceCardDto, {
        ...validPayload,
        nextDueMileage: 15000.5,
      });
      const errors = await validate(dto);
      const fieldErrors = errors.find((e) => e.property === 'nextDueMileage');
      expect(fieldErrors).toBeDefined();
    });

    it('rejects zero', async () => {
      const dto = plainToInstance(CreateMaintenanceCardDto, {
        ...validPayload,
        nextDueMileage: 0,
      });
      const errors = await validate(dto);
      const fieldErrors = errors.find((e) => e.property === 'nextDueMileage');
      expect(fieldErrors).toBeDefined();
    });

    it('rejects a value above 1_000_000', async () => {
      const dto = plainToInstance(CreateMaintenanceCardDto, {
        ...validPayload,
        nextDueMileage: 1_000_001,
      });
      const errors = await validate(dto);
      const fieldErrors = errors.find((e) => e.property === 'nextDueMileage');
      expect(fieldErrors).toBeDefined();
    });

    it('accepts null', async () => {
      const dto = plainToInstance(CreateMaintenanceCardDto, {
        ...validPayload,
        nextDueMileage: null,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('accepts when omitted', async () => {
      const dto = plainToInstance(CreateMaintenanceCardDto, validPayload);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('nextDueDate', () => {
    it('accepts a valid ISO date string', async () => {
      const dto = plainToInstance(CreateMaintenanceCardDto, {
        ...validPayload,
        nextDueDate: '2026-09-01',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects an invalid date string', async () => {
      const dto = plainToInstance(CreateMaintenanceCardDto, {
        ...validPayload,
        nextDueDate: 'not-a-date',
      });
      const errors = await validate(dto);
      const fieldErrors = errors.find((e) => e.property === 'nextDueDate');
      expect(fieldErrors).toBeDefined();
    });

    it('accepts null', async () => {
      const dto = plainToInstance(CreateMaintenanceCardDto, {
        ...validPayload,
        nextDueDate: null,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('accepts when omitted', async () => {
      const dto = plainToInstance(CreateMaintenanceCardDto, validPayload);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });
});
