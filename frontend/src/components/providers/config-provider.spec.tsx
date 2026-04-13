import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/api-client', () => ({
  setBaseUrl: vi.fn(),
}));

import { setBaseUrl } from '@/lib/api-client';
import { ConfigProvider } from './config-provider';

describe('ConfigProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls setBaseUrl with the backendUrl prop', () => {
    render(
      <ConfigProvider backendUrl="http://my-backend:4000">
        <div>child content</div>
      </ConfigProvider>,
    );
    expect(setBaseUrl).toHaveBeenCalledWith('http://my-backend:4000');
  });

  it('renders children', () => {
    render(
      <ConfigProvider backendUrl="http://localhost:3001">
        <div>child content</div>
      </ConfigProvider>,
    );
    expect(screen.getByText('child content')).toBeInTheDocument();
  });
});
