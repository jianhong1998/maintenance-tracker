import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCreateVehicle } from './useCreateVehicle';
import { QueryGroup } from '../../queries/keys';
import { createWrapperWithClient } from '../../queries/test-utils';

vi.mock('@/lib/api-client', () => ({
  apiClient: { post: vi.fn() },
}));

import { apiClient } from '@/lib/api-client';

const mockVehicle = {
  id: 'v1',
  brand: 'Toyota',
  model: 'Corolla',
  colour: 'Silver',
  mileage: 85000,
  mileageUnit: 'km' as const,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const createData = {
  brand: 'Toyota',
  model: 'Corolla',
  colour: 'Silver',
  mileage: 85000,
  mileageUnit: 'km' as const,
};

describe('useCreateVehicle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POSTs to /vehicles with the provided data', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockVehicle);
    const { wrapper } = createWrapperWithClient();
    const { result } = renderHook(() => useCreateVehicle(), { wrapper });

    act(() => {
      result.current.mutate(createData);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiClient.post).toHaveBeenCalledWith('/vehicles', createData);
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  it('returns the created vehicle on success', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockVehicle);
    const { wrapper } = createWrapperWithClient();
    const { result } = renderHook(() => useCreateVehicle(), { wrapper });

    act(() => {
      result.current.mutate(createData);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockVehicle);
  });

  it('invalidates [VEHICLES] on success', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockVehicle);
    const { wrapper, queryClient } = createWrapperWithClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useCreateVehicle(), { wrapper });

    act(() => {
      result.current.mutate(createData);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({
      queryKey: [QueryGroup.VEHICLES],
    });
  });

  it('sets isError and does not invalidate cache when POST fails', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('fail'));
    const { wrapper, queryClient } = createWrapperWithClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useCreateVehicle(), { wrapper });

    act(() => {
      result.current.mutate(createData);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(spy).not.toHaveBeenCalled();
  });
});
