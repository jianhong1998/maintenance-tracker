import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useRecordMileage } from './useRecordMileage';
import { QueryGroup } from '../../queries/keys';
import { createWrapperWithClient } from '../../queries/test-utils';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    patch: vi.fn(),
  },
}));

import { apiClient } from '@/lib/api-client';

const mockVehicle = {
  id: 'abc-123',
  brand: 'Toyota',
  model: 'Camry',
  colour: 'White',
  mileage: 60000,
  mileageUnit: 'km',
  mileageLastUpdatedAt: '2026-04-05T10:00:00.000Z',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2026-04-05T10:00:00.000Z',
};

describe('useRecordMileage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls apiClient.patch("/vehicles/:vehicleId/mileage", data)', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue(mockVehicle);

    const { wrapper } = createWrapperWithClient();
    const { result } = renderHook(() => useRecordMileage('abc-123'), {
      wrapper,
    });

    act(() => {
      result.current.mutate({ mileage: 60000 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.patch).toHaveBeenCalledWith('/vehicles/abc-123/mileage', {
      mileage: 60000,
    });
    expect(apiClient.patch).toHaveBeenCalledTimes(1);
  });

  it('returns the updated vehicle on success', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue(mockVehicle);

    const { wrapper } = createWrapperWithClient();
    const { result } = renderHook(() => useRecordMileage('abc-123'), {
      wrapper,
    });

    act(() => {
      result.current.mutate({ mileage: 60000 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockVehicle);
  });

  it('invalidates both the individual vehicle key and the list key on success', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue(mockVehicle);

    const { wrapper, queryClient } = createWrapperWithClient();
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useRecordMileage('abc-123'), {
      wrapper,
    });

    act(() => {
      result.current.mutate({ mileage: 60000 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: [QueryGroup.VEHICLES, 'abc-123'],
      exact: true,
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: [QueryGroup.VEHICLES],
      exact: true,
    });
  });

  it('sets isError when apiClient.patch rejects and does not invalidate cache', async () => {
    vi.mocked(apiClient.patch).mockRejectedValue(new Error('Network error'));

    const { wrapper, queryClient } = createWrapperWithClient();
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useRecordMileage('abc-123'), {
      wrapper,
    });

    act(() => {
      result.current.mutate({ mileage: 60000 });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
  });
});
