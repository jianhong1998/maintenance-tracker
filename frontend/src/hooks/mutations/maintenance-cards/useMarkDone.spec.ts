import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useMarkDone } from './useMarkDone';
import { QueryGroup } from '../../queries/keys';
import { createWrapperWithClient } from '../../queries/test-utils';

vi.mock('@/lib/api-client', () => ({
  apiClient: { post: vi.fn() },
}));

import { apiClient } from '@/lib/api-client';

const mockHistory = {
  id: 'hist-1',
  maintenanceCardId: 'card-1',
  doneAtMileage: 52000,
  doneAtDate: '2026-03-27',
  notes: null,
  createdAt: '2026-03-27T00:00:00.000Z',
};

describe('useMarkDone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POSTs to /vehicles/:vehicleId/maintenance-cards/:cardId/mark-done', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockHistory);
    const { wrapper } = createWrapperWithClient();
    const { result } = renderHook(() => useMarkDone('v1', 'card-1'), {
      wrapper,
    });

    act(() => {
      result.current.mutate({ doneAtMileage: 52000, notes: null });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiClient.post).toHaveBeenCalledWith(
      '/vehicles/v1/maintenance-cards/card-1/mark-done',
      { doneAtMileage: 52000, notes: null },
    );
  });

  it('invalidates [MAINTENANCE_CARDS, vehicleId] on success', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockHistory);
    const { wrapper, queryClient } = createWrapperWithClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useMarkDone('v1', 'card-1'), {
      wrapper,
    });

    act(() => {
      result.current.mutate({ doneAtMileage: 52000 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({
      queryKey: [QueryGroup.MAINTENANCE_CARDS, 'v1'],
    });
  });

  it('invalidates [VEHICLES, vehicleId] with exact:true on success', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockHistory);
    const { wrapper, queryClient } = createWrapperWithClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useMarkDone('v1', 'card-1'), {
      wrapper,
    });

    act(() => {
      result.current.mutate({ doneAtMileage: 52000 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({
      queryKey: [QueryGroup.VEHICLES, 'v1'],
      exact: true,
    });
  });

  it('sets isError and does not invalidate cache when POST fails', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('fail'));
    const { wrapper, queryClient } = createWrapperWithClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useMarkDone('v1', 'card-1'), {
      wrapper,
    });

    act(() => {
      result.current.mutate({ doneAtMileage: 52000 });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(spy).not.toHaveBeenCalled();
  });
});
