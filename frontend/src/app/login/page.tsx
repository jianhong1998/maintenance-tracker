'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuthContext();
  const router = useRouter();
  const [signInError, setSignInError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  const handleSignIn = async () => {
    setSignInError(null);
    try {
      await signInWithGoogle();
    } catch {
      setSignInError('Sign-in failed. Please try again.');
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <h1 className="text-2xl font-bold">Maintenance Tracker</h1>
        <p className="text-muted-foreground text-sm">
          Track your vehicle maintenance schedules
        </p>
        <Button
          onClick={() => void handleSignIn()}
          disabled={loading}
        >
          Sign in with Google
        </Button>
        {signInError && (
          <p className="text-destructive text-sm">{signInError}</p>
        )}
      </div>
    </main>
  );
}
