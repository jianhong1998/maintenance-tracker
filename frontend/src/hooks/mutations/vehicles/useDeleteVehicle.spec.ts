import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDeleteVehicle } from './useDeleteVehicle';
import { QueryGroup } from '../../queries/keys';
import { createWrapperWithClient } from '../../queries/test-utils';

vi.mock('@/lib/api-client', () => ({
  apiClient: { delete: vi.fn() },
}));

import { apiClient } from '@/lib/api-client';

describe('useDeleteVehicle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('DELETEs /vehicles/:vehicleId using the mutation variable as vehicleId', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(undefined);
    const { wrapper } = createWrapperWithClient();
    const { result } = renderHook(() => useDeleteVehicle(), { wrapper });

    act(() => {
      result.current.mutate('v1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiClient.delete).toHaveBeenCalledWith('/vehicles/v1');
  });

  it('invalidates [VEHICLES] on success', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(undefined);
    const { wrapper, queryClient } = createWrapperWithClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteVehicle(), { wrapper });

    act(() => {
      result.current.mutate('v1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({
      queryKey: [QueryGroup.VEHICLES],
    });
  });

  it('sets isError and does not invalidate cache when DELETE fails', async () => {
    vi.mocked(apiClient.delete).mockRejectedValue(new Error('fail'));
    const { wrapper, queryClient } = createWrapperWithClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteVehicle(), { wrapper });

    act(() => {
      result.current.mutate('v1');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(spy).not.toHaveBeenCalled();
  });
});
