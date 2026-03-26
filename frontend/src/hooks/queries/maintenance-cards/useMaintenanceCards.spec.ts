import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  useMaintenanceCards,
  maintenanceCardsQueryOptions,
} from './useMaintenanceCards';
import { QueryGroup } from '../keys';
import { createWrapper, createWrapperWithClient } from '../test-utils';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { apiClient } from '@/lib/api-client';

describe('useMaintenanceCards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use queryKey [QueryGroup.MAINTENANCE_CARDS, vehicleId]', async () => {
    const vehicleId = 'vehicle-123';
    vi.mocked(apiClient.get).mockResolvedValue([]);

    const { wrapper, queryClient } = createWrapperWithClient();
    const { result } = renderHook(() => useMaintenanceCards(vehicleId), {
      wrapper,
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

  it('should use queryKey [MAINTENANCE_CARDS, vehicleId, "urgency"] when sort="urgency"', async () => {
    const vehicleId = 'vehicle-123';
    vi.mocked(apiClient.get).mockResolvedValue([]);

    const { wrapper, queryClient } = createWrapperWithClient();
    const { result } = renderHook(
      () => useMaintenanceCards(vehicleId, 'urgency'),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cachedQuery = queryClient.getQueryCache().findAll({
      queryKey: [QueryGroup.MAINTENANCE_CARDS, vehicleId, 'urgency'],
    });
    expect(cachedQuery).toHaveLength(1);
  });

  it('should call apiClient.get with ?sort=urgency when sort="urgency"', async () => {
    const vehicleId = 'vehicle-123';
    vi.mocked(apiClient.get).mockResolvedValue([]);

    const { result } = renderHook(
      () => useMaintenanceCards(vehicleId, 'urgency'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.get).toHaveBeenCalledWith(
      '/vehicles/vehicle-123/maintenance-cards?sort=urgency',
    );
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  });

  it('should use queryKey [MAINTENANCE_CARDS, vehicleId, "name"] when sort="name"', async () => {
    const vehicleId = 'vehicle-123';
    vi.mocked(apiClient.get).mockResolvedValue([]);

    const { wrapper, queryClient } = createWrapperWithClient();
    const { result } = renderHook(
      () => useMaintenanceCards(vehicleId, 'name'),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cachedQuery = queryClient
      .getQueryCache()
      .findAll({ queryKey: [QueryGroup.MAINTENANCE_CARDS, vehicleId, 'name'] });
    expect(cachedQuery).toHaveLength(1);
  });

  it('should call apiClient.get with ?sort=name when sort="name"', async () => {
    const vehicleId = 'vehicle-123';
    vi.mocked(apiClient.get).mockResolvedValue([]);

    const { result } = renderHook(
      () => useMaintenanceCards(vehicleId, 'name'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.get).toHaveBeenCalledWith(
      '/vehicles/vehicle-123/maintenance-cards?sort=name',
    );
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  });
});

describe('maintenanceCardsQueryOptions', () => {
  it('should generate queryKey [MAINTENANCE_CARDS, vehicleId] without sort', () => {
    const vehicleId = 'vehicle-123';
    const options = maintenanceCardsQueryOptions(vehicleId);
    expect(options.queryKey).toEqual([QueryGroup.MAINTENANCE_CARDS, vehicleId]);
  });

  it('should generate URL without query string when no sort provided', async () => {
    const vehicleId = 'vehicle-123';
    vi.mocked(apiClient.get).mockResolvedValue([]);
    const options = maintenanceCardsQueryOptions(vehicleId);
    await options.queryFn();
    expect(apiClient.get).toHaveBeenCalledWith(
      '/vehicles/vehicle-123/maintenance-cards',
    );
  });

  it('should generate queryKey [MAINTENANCE_CARDS, vehicleId, sort] when sort is provided', () => {
    const vehicleId = 'vehicle-123';
    const options = maintenanceCardsQueryOptions(vehicleId, 'urgency');
    expect(options.queryKey).toEqual([
      QueryGroup.MAINTENANCE_CARDS,
      vehicleId,
      'urgency',
    ]);
  });

  it('should generate URL with ?sort=urgency when sort="urgency"', async () => {
    const vehicleId = 'vehicle-123';
    vi.mocked(apiClient.get).mockResolvedValue([]);
    const options = maintenanceCardsQueryOptions(vehicleId, 'urgency');
    await options.queryFn();
    expect(apiClient.get).toHaveBeenCalledWith(
      '/vehicles/vehicle-123/maintenance-cards?sort=urgency',
    );
  });
});
