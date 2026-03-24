import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AuthProvider } from '@/components/providers/auth-provider';
import { useAuthContext } from '@/contexts/auth-context';
import type { User } from 'firebase/auth';

const { mockOnAuthStateChanged, mockSetAuthTokenGetter } = vi.hoisted(() => ({
  mockOnAuthStateChanged: vi.fn(),
  mockSetAuthTokenGetter: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(),
  onAuthStateChanged: mockOnAuthStateChanged,
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/lib/firebase', () => ({
  auth: {},
}));

vi.mock('@/lib/api-client', () => ({
  setAuthTokenGetter: mockSetAuthTokenGetter,
}));

function TestConsumer() {
  const { user, loading } = useAuthContext();
  return (
    <div>
      <span data-testid="loading">{loading ? 'loading' : 'ready'}</span>
      <span data-testid="user">
        {user ? (user.email ?? 'no-email') : 'null'}
      </span>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnAuthStateChanged.mockReturnValue(vi.fn()); // default unsubscribe
  });

  it('starts in loading state before auth resolves', () => {
    // Never calls the callback - simulates in-flight auth check
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId('loading')).toHaveTextContent('loading');
    expect(screen.getByTestId('user')).toHaveTextContent('null');
  });

  it('transitions to ready with user when auth state resolves with a user', async () => {
    let authCallback!: (user: User | null) => void;
    mockOnAuthStateChanged.mockImplementation(
      (_auth: unknown, cb: (user: User | null) => void) => {
        authCallback = cb;
        return vi.fn();
      },
    );

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    const mockUser = {
      email: 'test@example.com',
      getIdToken: vi.fn().mockResolvedValue('token'),
    } as unknown as User;
    act(() => authCallback(mockUser));

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    });
  });

  it('transitions to ready with null user when signed out', async () => {
    let authCallback!: (user: User | null) => void;
    mockOnAuthStateChanged.mockImplementation(
      (_auth: unknown, cb: (user: User | null) => void) => {
        authCallback = cb;
        return vi.fn();
      },
    );

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    act(() => authCallback(null));

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      expect(screen.getByTestId('user')).toHaveTextContent('null');
    });
  });

  it('wires up auth token getter so API client can attach Bearer tokens', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    expect(mockSetAuthTokenGetter).toHaveBeenCalledWith(expect.any(Function));
  });
});
