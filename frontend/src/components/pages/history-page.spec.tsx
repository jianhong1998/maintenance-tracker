import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { HistoryPage } from '@/components/pages/history-page';

vi.mock('@/components/auth/auth-guard', () => ({
  AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('HistoryPage component', () => {
  it('renders the HISTORY eyebrow label', () => {
    render(<HistoryPage />);
    expect(screen.getByText('HISTORY')).toBeInTheDocument();
  });

  it('renders the coming soon message', () => {
    render(<HistoryPage />);
    expect(screen.getByText('Coming soon.')).toBeInTheDocument();
  });
});
