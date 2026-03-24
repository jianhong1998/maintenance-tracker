import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useVehicles } from './useVehicles';
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

describe('useVehicles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use queryKey ["vehicles"] (QueryGroup.VEHICLES)', async () => {
    const mockVehicles = [
      {
        id: '1',
        brand: 'Toyota',
        model: 'Camry',
        colour: 'White',
        mileage: 50000,
        mileageUnit: 'km',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ];

    vi.mocked(apiClient.get).mockResolvedValue(mockVehicles);

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

    const { result } = renderHook(() => useVehicles(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockVehicles);
    // Verify the hook actually registered a query under [QueryGroup.VEHICLES] in the cache
    const cachedQuery = queryClient
      .getQueryCache()
      .findAll({ queryKey: [QueryGroup.VEHICLES] });
    expect(cachedQuery).toHaveLength(1);
  });

  it('should call apiClient.get("/vehicles") in its queryFn', async () => {
    const mockVehicles = [
      {
        id: '2',
        brand: 'Honda',
        model: 'Civic',
        colour: 'Blue',
        mileage: 30000,
        mileageUnit: 'km',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ];

    vi.mocked(apiClient.get).mockResolvedValue(mockVehicles);

    const { result } = renderHook(() => useVehicles(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.get).toHaveBeenCalledWith('/vehicles');
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  });

  it('should be enabled by default (always fetches)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([]);

    const { result } = renderHook(() => useVehicles(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // If enabled were false, fetchStatus would be 'idle' and isSuccess would be false
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.status).toBe('success');
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  });
});
