import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { usePatchMaintenanceCard } from './usePatchMaintenanceCard';
import { QueryGroup } from '../../queries/keys';
import { createWrapperWithClient } from '../../queries/test-utils';

vi.mock('@/lib/api-client', () => ({
  apiClient: { patch: vi.fn() },
}));

import { apiClient } from '@/lib/api-client';

const mockCard = {
  id: 'card-1',
  vehicleId: 'v1',
  type: 'task' as const,
  name: 'Oil Change Updated',
  description: null,
  intervalMileage: 7000,
  intervalTimeMonths: null,
  nextDueMileage: null,
  nextDueDate: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-06-01T00:00:00.000Z',
};

const patchData = { name: 'Oil Change Updated', intervalMileage: 7000 };

describe('usePatchMaintenanceCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('PATCHes /vehicles/:vehicleId/maintenance-cards/:cardId with the provided data', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue(mockCard);
    const { wrapper } = createWrapperWithClient();
    const { result } = renderHook(
      () => usePatchMaintenanceCard('v1', 'card-1'),
      { wrapper },
    );

    act(() => {
      result.current.mutate(patchData);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiClient.patch).toHaveBeenCalledWith(
      '/vehicles/v1/maintenance-cards/card-1',
      patchData,
    );
    expect(apiClient.patch).toHaveBeenCalledTimes(1);
  });

  it('invalidates [MAINTENANCE_CARDS, vehicleId] on success', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue(mockCard);
    const { wrapper, queryClient } = createWrapperWithClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(
      () => usePatchMaintenanceCard('v1', 'card-1'),
      { wrapper },
    );

    act(() => {
      result.current.mutate(patchData);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({
      queryKey: [QueryGroup.MAINTENANCE_CARDS, 'v1'],
    });
  });

  it('sets isError and does not invalidate cache when PATCH fails', async () => {
    vi.mocked(apiClient.patch).mockRejectedValue(new Error('fail'));
    const { wrapper, queryClient } = createWrapperWithClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(
      () => usePatchMaintenanceCard('v1', 'card-1'),
      { wrapper },
    );

    act(() => {
      result.current.mutate(patchData);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(spy).not.toHaveBeenCalled();
  });
});
