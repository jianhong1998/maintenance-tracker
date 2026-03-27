import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  type IVehicleResDTO,
  type IMaintenanceCardResDTO,
  MAINTENANCE_CARD_TYPES,
} from '@project/types';
import { useGlobalWarningCount } from './useGlobalWarningCount';
import { QueryGroup } from '../keys';
import { createWrapperWithClient } from '../test-utils';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { apiClient } from '@/lib/api-client';

function makeVehicle(overrides: Partial<IVehicleResDTO> = {}): IVehicleResDTO {
  return {
    id: 'vehicle-1',
    brand: 'Toyota',
    model: 'Camry',
    colour: 'White',
    mileage: 50000,
    mileageUnit: 'km',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeCard(
  overrides: Partial<IMaintenanceCardResDTO> = {},
): IMaintenanceCardResDTO {
  return {
    id: 'card-1',
    vehicleId: 'vehicle-1',
    type: MAINTENANCE_CARD_TYPES.TASK,
    name: 'Oil Change',
    description: null,
    intervalMileage: 5000,
    intervalTimeMonths: 6,
    nextDueMileage: 60000,
    nextDueDate: '2099-01-01',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('useGlobalWarningCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 0 immediately when vehicles array is empty', () => {
    const { wrapper } = createWrapperWithClient();
    const { result } = renderHook(() => useGlobalWarningCount([], 500), {
      wrapper,
    });
    expect(result.current).toBe(0);
  });

  it('aggregates warning counts across multiple vehicles', async () => {
    const vehicle1 = makeVehicle({ id: 'v1', mileage: 50000 });
    const vehicle2 = makeVehicle({ id: 'v2', mileage: 30000 });

    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes('v1')) {
        // one overdue card for vehicle1
        return Promise.resolve([makeCard({ nextDueDate: '2020-01-01' })]);
      }
      // all ok for vehicle2
      return Promise.resolve([makeCard()]);
    });

    const { wrapper } = createWrapperWithClient();
    const { result } = renderHook(
      () => useGlobalWarningCount([vehicle1, vehicle2], 500),
      { wrapper },
    );

    await waitFor(() => expect(result.current).toBe(1));
  });

  it('uses the MAINTENANCE_CARDS query key for deduplication', async () => {
    const vehicle = makeVehicle({ id: 'v1' });
    vi.mocked(apiClient.get).mockResolvedValue([]);

    const { wrapper, queryClient } = createWrapperWithClient();
    renderHook(() => useGlobalWarningCount([vehicle], 500), { wrapper });

    await waitFor(() => {
      const cached = queryClient
        .getQueryCache()
        .findAll({ queryKey: [QueryGroup.MAINTENANCE_CARDS, 'v1'] });
      expect(cached).toHaveLength(1);
    });
  });
});
