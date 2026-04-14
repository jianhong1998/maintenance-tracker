import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import LoginPageRoute from '@/app/login/page';

vi.mock('@/components/pages/login-page', () => ({
  LoginPage: () => <div data-testid="login-page-component">LoginPage</div>,
}));

vi.mock('@/lib/firebase', () => ({
  auth: {},
}));

describe('login/page.tsx route', () => {
  it('renders the LoginPage component', () => {
    render(<LoginPageRoute />);
    expect(screen.getByTestId('login-page-component')).toBeInTheDocument();
  });
});
