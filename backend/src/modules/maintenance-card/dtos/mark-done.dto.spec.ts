import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { describe, it, expect } from 'vitest';
import { MarkDoneDto } from './mark-done.dto';

describe('MarkDoneDto', () => {
  describe('doneAtMileage', () => {
    it('rejects a value above 1_000_000', async () => {
      const dto = plainToInstance(MarkDoneDto, {
        doneAtMileage: 1_000_001,
      });
      const errors = await validate(dto);
      const fieldErrors = errors.find((e) => e.property === 'doneAtMileage');
      expect(fieldErrors).toBeDefined();
    });

    it('rejects a float value', async () => {
      const dto = plainToInstance(MarkDoneDto, { doneAtMileage: 1.5 });
      const errors = await validate(dto);
      const fieldErrors = errors.find((e) => e.property === 'doneAtMileage');
      expect(fieldErrors).toBeDefined();
    });
  });
});
