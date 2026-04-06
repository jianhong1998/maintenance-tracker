import { describe, it, expect } from 'vitest';
import type { IVehicleResDTO } from '@project/types';
import { getVehicleDisplayLabels } from './vehicle-display';

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
