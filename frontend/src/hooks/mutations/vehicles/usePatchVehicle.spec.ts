import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { usePatchVehicle } from './usePatchVehicle';
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
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-06-01T00:00:00.000Z',
};

const patchData = { mileage: 60000 };

describe('usePatchVehicle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call apiClient.patch("/vehicles/:vehicleId", data) in mutationFn', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue(mockVehicle);

    const { wrapper } = createWrapperWithClient();
    const { result } = renderHook(() => usePatchVehicle('abc-123'), {
      wrapper,
    });

    act(() => {
      result.current.mutate(patchData);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.patch).toHaveBeenCalledWith(
      '/vehicles/abc-123',
      patchData,
    );
    expect(apiClient.patch).toHaveBeenCalledTimes(1);
  });

  it('should return the updated vehicle data on success', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue(mockVehicle);

    const { wrapper } = createWrapperWithClient();
    const { result } = renderHook(() => usePatchVehicle('abc-123'), {
      wrapper,
    });

    act(() => {
      result.current.mutate(patchData);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockVehicle);
  });

  it('should NOT call queryClient.setQueryData on success', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue(mockVehicle);

    const { wrapper, queryClient } = createWrapperWithClient();
    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');

    const { result } = renderHook(() => usePatchVehicle('abc-123'), {
      wrapper,
    });

    act(() => {
      result.current.mutate(patchData);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(setQueryDataSpy).not.toHaveBeenCalled();
  });

  it('should call queryClient.invalidateQueries for individual vehicle key with exact:true on success', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue(mockVehicle);

    const { wrapper, queryClient } = createWrapperWithClient();
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => usePatchVehicle('abc-123'), {
      wrapper,
    });

    act(() => {
      result.current.mutate(patchData);
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

  it('should set isError when apiClient.patch rejects and not update the cache', async () => {
    const vehicleId = 'v1';
    const error = new Error('Network error');
    vi.mocked(apiClient.patch).mockRejectedValue(error);

    const { wrapper, queryClient } = createWrapperWithClient();
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => usePatchVehicle(vehicleId), {
      wrapper,
    });

    act(() => {
      result.current.mutate({ mileage: 10000 });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
  });

  it('should throw an error when vehicleId is empty string', async () => {
    const { wrapper } = createWrapperWithClient();
    const { result } = renderHook(() => usePatchVehicle(''), {
      wrapper,
    });

    act(() => {
      result.current.mutate(patchData);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('vehicleId is required');
  });
});
