import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { describe, it, expect } from 'vitest';
import { RecordMileageDto } from './record-mileage.dto';

describe('RecordMileageDto', () => {
  it('accepts a valid positive mileage', async () => {
    const dto = plainToInstance(RecordMileageDto, { mileage: 1000 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts zero mileage', async () => {
    const dto = plainToInstance(RecordMileageDto, { mileage: 0 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a negative mileage', async () => {
    const dto = plainToInstance(RecordMileageDto, { mileage: -1 });
    const errors = await validate(dto);
    const mileageErrors = errors.find((e) => e.property === 'mileage');
    expect(mileageErrors).toBeDefined();
  });

  it('rejects a value above 1_000_000', async () => {
    const dto = plainToInstance(RecordMileageDto, { mileage: 1_000_001 });
    const errors = await validate(dto);
    const mileageErrors = errors.find((e) => e.property === 'mileage');
    expect(mileageErrors).toBeDefined();
  });

  it('rejects a non-number mileage', async () => {
    const dto = plainToInstance(RecordMileageDto, { mileage: 'abc' });
    const errors = await validate(dto);
    const mileageErrors = errors.find((e) => e.property === 'mileage');
    expect(mileageErrors).toBeDefined();
  });

  it('rejects missing mileage', async () => {
    const dto = plainToInstance(RecordMileageDto, {});
    const errors = await validate(dto);
    const mileageErrors = errors.find((e) => e.property === 'mileage');
    expect(mileageErrors).toBeDefined();
  });
});
