import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FeatureFlagGuard } from './feature-flag-guard';

const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { apiClient } from '@/lib/api-client';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  wrapper.displayName = 'TestQueryClientWrapper';
  return wrapper;
};

describe('FeatureFlagGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders null while feature flags are loading', () => {
    // Never resolves — simulates loading state
    vi.mocked(apiClient.get).mockReturnValue(new Promise(() => {}));

    const { container } = render(
      <FeatureFlagGuard flagKey="enableHistory">
        <div>Protected</div>
      </FeatureFlagGuard>,
      { wrapper: createWrapper() },
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders children when the flag is true', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      enableHistory: true,
      enableProfile: false,
    });

    render(
      <FeatureFlagGuard flagKey="enableHistory">
        <div>Protected Content</div>
      </FeatureFlagGuard>,
      { wrapper: createWrapper() },
    );

    await waitFor(() =>
      expect(screen.getByText('Protected Content')).toBeInTheDocument(),
    );
  });

  it('redirects to / when the flag is false', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      enableHistory: false,
      enableProfile: false,
    });

    render(
      <FeatureFlagGuard flagKey="enableHistory">
        <div>Protected Content</div>
      </FeatureFlagGuard>,
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });

  it('renders null (no flash) when flag is false and redirect is in progress', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      enableHistory: false,
      enableProfile: false,
    });

    const { container } = render(
      <FeatureFlagGuard flagKey="enableHistory">
        <div>Protected Content</div>
      </FeatureFlagGuard>,
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(container.firstChild).toBeNull();
  });

  it('works for enableProfile flag key', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      enableHistory: false,
      enableProfile: true,
    });

    render(
      <FeatureFlagGuard flagKey="enableProfile">
        <div>Profile Content</div>
      </FeatureFlagGuard>,
      { wrapper: createWrapper() },
    );

    await waitFor(() =>
      expect(screen.getByText('Profile Content')).toBeInTheDocument(),
    );
  });
});
