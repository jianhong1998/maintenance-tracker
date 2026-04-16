import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFeatureFlags } from './useFeatureFlags';
import { QueryGroup } from '../keys';
import { createWrapper, createWrapperWithClient } from '../test-utils';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { apiClient } from '@/lib/api-client';

const mockFlags = { enableHistory: true, enableProfile: false };

describe('useFeatureFlags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses queryKey [QueryGroup.FEATURE_FLAG]', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(mockFlags);

    const { wrapper, queryClient } = createWrapperWithClient();
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = queryClient
      .getQueryCache()
      .findAll({ queryKey: [QueryGroup.FEATURE_FLAG] });
    expect(cached).toHaveLength(1);
  });

  it('calls apiClient.get("/config/feature-flag")', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(mockFlags);

    const { result } = renderHook(() => useFeatureFlags(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.get).toHaveBeenCalledWith('/config/feature-flag');
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  });

  it('returns the feature flags data', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(mockFlags);

    const { result } = renderHook(() => useFeatureFlags(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockFlags);
  });
});
