import { describe, it, expect } from 'vitest';
import type { IVehicleResDTO } from '@project/types';
import {
  getVehicleDisplayLabels,
  getVehicleCardMetaLine,
} from './vehicle-display';

const baseVehicle: IVehicleResDTO = {
  id: 'v1',
  brand: 'Honda',
  model: 'ADV 160',
  colour: 'Black',
  mileage: 100,
  mileageUnit: 'km',
  mileageLastUpdatedAt: null,
  registrationNumber: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('getVehicleDisplayLabels', () => {
  it('returns brand + model as primary and null secondary when registrationNumber is null', () => {
    const { primary, secondary } = getVehicleDisplayLabels(baseVehicle);
    expect(primary).toBe('Honda ADV 160');
    expect(secondary).toBeNull();
  });

  it('returns registrationNumber as primary and brand + model as secondary when registrationNumber is set', () => {
    const vehicle = { ...baseVehicle, registrationNumber: 'FBA1234Z' };
    const { primary, secondary } = getVehicleDisplayLabels(vehicle);
    expect(primary).toBe('FBA1234Z');
    expect(secondary).toBe('Honda ADV 160');
  });

  it('handles a registrationNumber with spaces and unicode', () => {
    const vehicle = { ...baseVehicle, registrationNumber: 'ABC 123 ü' };
    const { primary, secondary } = getVehicleDisplayLabels(vehicle);
    expect(primary).toBe('ABC 123 ü');
    expect(secondary).toBe('Honda ADV 160');
  });
});

describe('getVehicleCardMetaLine', () => {
  it('returns colour and mileage without plate number', () => {
    const vehicle = { ...baseVehicle, registrationNumber: 'FBA1234Z' };
    expect(getVehicleCardMetaLine(vehicle)).toBe('Black · 100 km');
  });

  it('returns colour and mileage when registrationNumber is null', () => {
    expect(getVehicleCardMetaLine(baseVehicle)).toBe('Black · 100 km');
  });

  it('formats mileage with locale separators', () => {
    const vehicle = { ...baseVehicle, mileage: 50000 };
    expect(getVehicleCardMetaLine(vehicle)).toBe('Black · 50,000 km');
  });

  it('includes mileageUnit in the meta line', () => {
    const vehicle = { ...baseVehicle, mileageUnit: 'mile' as const };
    expect(getVehicleCardMetaLine(vehicle)).toBe('Black · 100 mile');
  });
});
