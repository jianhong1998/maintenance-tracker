import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useVersion } from './useVersion';
import { createWrapper } from '../test-utils';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { apiClient } from '@/lib/api-client';

describe('useVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls apiClient.get("/version")', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ version: '1.1.2' });

    const { result } = renderHook(() => useVersion(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.get).toHaveBeenCalledWith('/version');
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  });

  it('returns the version data', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ version: '1.1.2' });

    const { result } = renderHook(() => useVersion(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({ version: '1.1.2' });
  });
});
