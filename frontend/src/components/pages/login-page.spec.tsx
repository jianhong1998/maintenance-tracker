import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { LoginPage } from '@/components/pages/login-page';
import { AuthContext } from '@/contexts/auth-context';
import type { AuthContextValue } from '@/contexts/auth-context';
import type { User } from 'firebase/auth';

const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock('@/lib/firebase', () => ({
  auth: {},
}));

function renderLoginPage(overrides: Partial<AuthContextValue> = {}) {
  const defaultContext: AuthContextValue = {
    user: null,
    loading: false,
    authError: null,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  };
  return render(
    <AuthContext.Provider value={defaultContext}>
      <LoginPage />
    </AuthContext.Provider>,
  );
}

describe('LoginPage component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('disables sign-in button while auth state is loading', () => {
    renderLoginPage({ loading: true });
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled();
  });

  it('disables sign-in button while sign-in is in progress', async () => {
    let resolveSignIn!: () => void;
    const signInWithGoogle = vi.fn(
      () => new Promise<void>((res) => (resolveSignIn = res)),
    );
    renderLoginPage({ signInWithGoogle });

    const button = screen.getByRole('button', { name: /sign in/i });
    await userEvent.click(button);

    expect(button).toBeDisabled();

    resolveSignIn();
    await waitFor(() => expect(button).toBeEnabled());
  });

  it('shows error message when sign-in fails', async () => {
    const signInWithGoogle = vi
      .fn()
      .mockRejectedValue(new Error('Auth failed'));
    renderLoginPage({ signInWithGoogle });

    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Sign-in failed. Please try again.'),
      ).toBeInTheDocument();
    });
  });

  it('redirects to home when user is already authenticated', async () => {
    const mockUser = { uid: '123' } as User;
    renderLoginPage({ user: mockUser, loading: false });

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });

  it('shows "SIGNING IN..." text on the button while sign-in is in progress', async () => {
    const signInWithGoogle = vi.fn(() => new Promise<void>(() => {})); // never resolves
    renderLoginPage({ signInWithGoogle });

    await userEvent.click(
      screen.getByRole('button', { name: /sign in with google/i }),
    );

    expect(
      screen.getByRole('button', { name: /signing in/i }),
    ).toBeInTheDocument();
  });

  it('clears previous sign-in error when a new sign-in attempt starts', async () => {
    const signInWithGoogle = vi
      .fn()
      .mockRejectedValueOnce(new Error('Auth failed'))
      .mockReturnValue(new Promise<void>(() => {})); // second call never resolves
    renderLoginPage({ signInWithGoogle });

    // First click — triggers error
    await userEvent.click(
      screen.getByRole('button', { name: /sign in with google/i }),
    );
    await waitFor(() => {
      expect(
        screen.getByText('Sign-in failed. Please try again.'),
      ).toBeInTheDocument();
    });

    // Second click — error should be cleared before new sign-in attempt
    await userEvent.click(
      screen.getByRole('button', { name: /sign in with google/i }),
    );
    expect(
      screen.queryByText('Sign-in failed. Please try again.'),
    ).not.toBeInTheDocument();
  });
});
