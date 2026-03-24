import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useMaintenanceCards } from './useMaintenanceCards';
import { QueryGroup } from '../keys';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { apiClient } from '@/lib/api-client';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = 'TestQueryClientWrapper';
  return Wrapper;
};

describe('useMaintenanceCards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use queryKey [QueryGroup.MAINTENANCE_CARDS, vehicleId]', async () => {
    const vehicleId = 'vehicle-123';
    vi.mocked(apiClient.get).mockResolvedValue([]);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const Wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children,
      );
    Wrapper.displayName = 'TestQueryClientWrapper';

    const { result } = renderHook(() => useMaintenanceCards(vehicleId), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cachedQuery = queryClient
      .getQueryCache()
      .findAll({ queryKey: [QueryGroup.MAINTENANCE_CARDS, vehicleId] });
    expect(cachedQuery).toHaveLength(1);
  });

  it('should call apiClient.get("/vehicles/vehicle-123/maintenance-cards") in its queryFn', async () => {
    const vehicleId = 'vehicle-123';
    vi.mocked(apiClient.get).mockResolvedValue([]);

    const { result } = renderHook(() => useMaintenanceCards(vehicleId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.get).toHaveBeenCalledWith(
      '/vehicles/vehicle-123/maintenance-cards',
    );
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  });

  it('should NOT fetch when vehicleId is an empty string (enabled: false)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([]);

    const { result } = renderHook(() => useMaintenanceCards(''), {
      wrapper: createWrapper(),
    });

    // With enabled: false, query stays in 'pending' status with fetchStatus 'idle'
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.status).toBe('pending');
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('should fetch when vehicleId is provided', async () => {
    const vehicleId = 'vehicle-123';
    vi.mocked(apiClient.get).mockResolvedValue([]);

    const { result } = renderHook(() => useMaintenanceCards(vehicleId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('success');
  });
});
