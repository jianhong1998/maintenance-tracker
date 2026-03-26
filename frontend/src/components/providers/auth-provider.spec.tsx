import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AuthProvider } from '@/components/providers/auth-provider';
import { useAuthContext } from '@/contexts/auth-context';
import type { User } from 'firebase/auth';

const {
  mockOnAuthStateChanged,
  mockSetAuthTokenGetter,
  mockGetFirebaseConfig,
  mockInitFirebase,
  mockGetFirebaseAuth,
} = vi.hoisted(() => ({
  mockOnAuthStateChanged: vi.fn(),
  mockSetAuthTokenGetter: vi.fn(),
  mockGetFirebaseConfig: vi.fn(),
  mockInitFirebase: vi.fn(),
  mockGetFirebaseAuth: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(),
  onAuthStateChanged: mockOnAuthStateChanged,
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/lib/firebase', () => ({
  initFirebase: mockInitFirebase,
  getFirebaseAuth: mockGetFirebaseAuth,
}));

vi.mock('@/actions/firebase-config', () => ({
  getFirebaseConfig: mockGetFirebaseConfig,
}));

vi.mock('@/lib/api-client', () => ({
  setAuthTokenGetter: mockSetAuthTokenGetter,
}));

const testConfig = {
  apiKey: 'test-key',
  authDomain: 'test.firebaseapp.com',
  projectId: 'test-project',
};

const mockAuthInstance = { name: 'test-auth' };

function TestConsumer() {
  const { user, loading, authError } = useAuthContext();
  return (
    <div>
      <span data-testid="loading">{loading ? 'loading' : 'ready'}</span>
      <span data-testid="user">
        {user ? (user.email ?? 'no-email') : 'null'}
      </span>
      <span data-testid="error">{authError ? authError.message : 'none'}</span>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFirebaseConfig.mockResolvedValue(testConfig);
    mockInitFirebase.mockReturnValue(mockAuthInstance);
    mockGetFirebaseAuth.mockReturnValue(mockAuthInstance);
    mockOnAuthStateChanged.mockReturnValue(vi.fn()); // default unsubscribe
  });

  it('starts in loading state before auth resolves', () => {
    // onAuthStateChanged never calls callback — simulates in-flight auth check
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

    await waitFor(() => expect(authCallback).toBeDefined());
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

    await waitFor(() => expect(authCallback).toBeDefined());
    act(() => authCallback(null));

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      expect(screen.getByTestId('user')).toHaveTextContent('null');
    });
  });

  it('sets authError and loading=false when getFirebaseConfig rejects', async () => {
    mockGetFirebaseConfig.mockRejectedValue(new Error('Config fetch failed'));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      expect(screen.getByTestId('error')).toHaveTextContent(
        'Config fetch failed',
      );
    });
  });

  it('sets authError and loading=false when initFirebase throws', async () => {
    mockInitFirebase.mockImplementation(() => {
      throw new Error('Missing required Firebase config: apiKey');
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      expect(screen.getByTestId('error')).toHaveTextContent(
        'Missing required Firebase config: apiKey',
      );
    });
  });

  it('wires up auth token getter after successful init', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(mockSetAuthTokenGetter).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  it('wires up onAuthStateChanged after successful init', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(mockOnAuthStateChanged).toHaveBeenCalledWith(
        mockAuthInstance,
        expect.any(Function),
      );
    });
  });

  it('signInWithGoogle calls getFirebaseAuth to retrieve auth instance', async () => {
    const { signInWithPopup } = await import('firebase/auth');

    function SignInButton() {
      const { signInWithGoogle } = useAuthContext();
      return <button onClick={signInWithGoogle}>Sign In</button>;
    }

    render(
      <AuthProvider>
        <SignInButton />
      </AuthProvider>,
    );

    await waitFor(() => expect(mockInitFirebase).toHaveBeenCalled());

    await act(async () => {
      screen.getByRole('button', { name: 'Sign In' }).click();
    });

    expect(mockGetFirebaseAuth).toHaveBeenCalled();
    expect(signInWithPopup).toHaveBeenCalledWith(
      mockAuthInstance,
      expect.any(Object),
    );
  });

  it('signOut calls getFirebaseAuth to retrieve auth instance', async () => {
    const { signOut: firebaseSignOut } = await import('firebase/auth');

    function SignOutButton() {
      const { signOut } = useAuthContext();
      return <button onClick={signOut}>Sign Out</button>;
    }

    render(
      <AuthProvider>
        <SignOutButton />
      </AuthProvider>,
    );

    await waitFor(() => expect(mockInitFirebase).toHaveBeenCalled());

    await act(async () => {
      screen.getByRole('button', { name: 'Sign Out' }).click();
    });

    expect(mockGetFirebaseAuth).toHaveBeenCalled();
    expect(firebaseSignOut).toHaveBeenCalledWith(mockAuthInstance);
  });
});
