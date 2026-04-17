import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { HistoryPage } from '@/components/pages/history-page';

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
