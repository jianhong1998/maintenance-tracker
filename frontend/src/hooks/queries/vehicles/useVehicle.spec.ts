import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useVehicle } from './useVehicle';
import { QueryGroup } from '../keys';
import { createWrapper, createWrapperWithClient } from '../test-utils';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { apiClient } from '@/lib/api-client';

const mockVehicle = {
  id: 'abc-123',
  brand: 'Toyota',
  model: 'Camry',
  colour: 'White',
  mileage: 50000,
  mileageUnit: 'km',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('useVehicle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use queryKey [QueryGroup.VEHICLES, vehicleId]', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(mockVehicle);

    const { wrapper, queryClient } = createWrapperWithClient();
    const { result } = renderHook(() => useVehicle('abc-123'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockVehicle);
    const cachedQuery = queryClient
      .getQueryCache()
      .findAll({ queryKey: [QueryGroup.VEHICLES, 'abc-123'] });
    expect(cachedQuery).toHaveLength(1);
  });

  it('should call apiClient.get("/vehicles/:vehicleId") in its queryFn', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(mockVehicle);

    const { result } = renderHook(() => useVehicle('abc-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.get).toHaveBeenCalledWith('/vehicles/abc-123');
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when vehicleId is empty string', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(mockVehicle);

    const { result } = renderHook(() => useVehicle(''), {
      wrapper: createWrapper(),
    });

    // When enabled is false, the query stays in 'pending' status with fetchStatus 'idle'
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.status).toBe('pending');
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('should return vehicle data on success', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(mockVehicle);

    const { result } = renderHook(() => useVehicle('abc-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockVehicle);
  });
});
