import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCreateMaintenanceCard } from './useCreateMaintenanceCard';
import { QueryGroup } from '../../queries/keys';
import { createWrapperWithClient } from '../../queries/test-utils';

vi.mock('@/lib/api-client', () => ({
  apiClient: { post: vi.fn() },
}));

import { apiClient } from '@/lib/api-client';

const mockCard = {
  id: 'card-1',
  vehicleId: 'v1',
  type: 'task' as const,
  name: 'Oil Change',
  description: null,
  intervalMileage: 5000,
  intervalTimeMonths: null,
  nextDueMileage: null,
  nextDueDate: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const createData = {
  type: 'task' as const,
  name: 'Oil Change',
  intervalMileage: 5000,
};

describe('useCreateMaintenanceCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POSTs to /vehicles/:vehicleId/maintenance-cards with the provided data', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockCard);
    const { wrapper } = createWrapperWithClient();
    const { result } = renderHook(() => useCreateMaintenanceCard('v1'), {
      wrapper,
    });

    act(() => {
      result.current.mutate(createData);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiClient.post).toHaveBeenCalledWith(
      '/vehicles/v1/maintenance-cards',
      createData,
    );
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  it('returns the created card on success', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockCard);
    const { wrapper } = createWrapperWithClient();
    const { result } = renderHook(() => useCreateMaintenanceCard('v1'), {
      wrapper,
    });

    act(() => {
      result.current.mutate(createData);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockCard);
  });

  it('invalidates [MAINTENANCE_CARDS, vehicleId] on success', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockCard);
    const { wrapper, queryClient } = createWrapperWithClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useCreateMaintenanceCard('v1'), {
      wrapper,
    });

    act(() => {
      result.current.mutate(createData);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({
      queryKey: [QueryGroup.MAINTENANCE_CARDS, 'v1'],
    });
  });

  it('sets isError and does not invalidate cache when POST fails', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('fail'));
    const { wrapper, queryClient } = createWrapperWithClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useCreateMaintenanceCard('v1'), {
      wrapper,
    });

    act(() => {
      result.current.mutate(createData);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(spy).not.toHaveBeenCalled();
  });
});
