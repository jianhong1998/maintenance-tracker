import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AuthGuard } from '@/components/auth/auth-guard';
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

function renderWithContext(contextValue: AuthContextValue) {
  return render(
    <AuthContext.Provider value={contextValue}>
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    </AuthContext.Provider>,
  );
}

describe('AuthGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading when auth state is initializing', () => {
    renderWithContext({
      user: null,
      loading: true,
      authError: null,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('redirects to /login when user is not authenticated', async () => {
    renderWithContext({
      user: null,
      loading: false,
      authError: null,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
  });

  it('renders nothing (no flash) while redirect is in progress', () => {
    const { container } = renderWithContext({
      user: null,
      loading: false,
      authError: null,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });
    expect(container.firstChild).toBeNull();
  });

  it('renders children when user is authenticated', () => {
    const mockUser = { uid: '123', email: 'test@example.com' } as User;
    renderWithContext({
      user: mockUser,
      loading: false,
      authError: null,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});
