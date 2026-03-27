import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDeleteMaintenanceCard } from './useDeleteMaintenanceCard';
import { QueryGroup } from '../../queries/keys';
import { createWrapperWithClient } from '../../queries/test-utils';

vi.mock('@/lib/api-client', () => ({
  apiClient: { delete: vi.fn() },
}));

import { apiClient } from '@/lib/api-client';

describe('useDeleteMaintenanceCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('DELETEs /vehicles/:vehicleId/maintenance-cards/:cardId using the mutation variable as cardId', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(undefined);
    const { wrapper } = createWrapperWithClient();
    const { result } = renderHook(() => useDeleteMaintenanceCard('v1'), {
      wrapper,
    });

    act(() => {
      result.current.mutate('card-99');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiClient.delete).toHaveBeenCalledWith(
      '/vehicles/v1/maintenance-cards/card-99',
    );
  });

  it('invalidates [MAINTENANCE_CARDS, vehicleId] on success', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(undefined);
    const { wrapper, queryClient } = createWrapperWithClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteMaintenanceCard('v1'), {
      wrapper,
    });

    act(() => {
      result.current.mutate('card-99');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({
      queryKey: [QueryGroup.MAINTENANCE_CARDS, 'v1'],
    });
  });

  it('sets isError and does not invalidate cache when DELETE fails', async () => {
    vi.mocked(apiClient.delete).mockRejectedValue(new Error('fail'));
    const { wrapper, queryClient } = createWrapperWithClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteMaintenanceCard('v1'), {
      wrapper,
    });

    act(() => {
      result.current.mutate('card-99');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(spy).not.toHaveBeenCalled();
  });
});
