import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ProfilePage } from '@/components/pages/profile-page';

describe('ProfilePage component', () => {
  it('renders the PROFILE eyebrow label', () => {
    render(<ProfilePage />);
    expect(screen.getByText('PROFILE')).toBeInTheDocument();
  });

  it('renders the coming soon message', () => {
    render(<ProfilePage />);
    expect(screen.getByText('Coming soon.')).toBeInTheDocument();
  });
});
