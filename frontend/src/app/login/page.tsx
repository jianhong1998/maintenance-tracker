'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuthContext();
  const router = useRouter();
  const [signInError, setSignInError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  const handleSignIn = async () => {
    setSignInError(null);
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch {
      setSignInError('Sign-in failed. Please try again.');
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center gap-6 w-full max-w-xs">
        {/* Logo mark with ambient radial glow */}
        <div className="relative flex items-center justify-center">
          <div
            aria-hidden="true"
            className="absolute w-40 h-40"
            style={{
              background: 'radial-gradient(circle, #00e5ff12, transparent 70%)',
            }}
          />
          <div className="relative w-[52px] h-[52px] rounded-2xl border border-[#00e5ff40] bg-[#00e5ff12] flex items-center justify-center">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#00e5ff] to-[#0066ff]" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center">
          <p
            className="text-primary font-bold mb-1"
            style={{ fontSize: '0.6rem', letterSpacing: '0.3em' }}
          >
            MAINTENANCE
          </p>
          <h1 className="text-white font-extrabold tracking-tight text-[1.5rem]">
            TRACKER
          </h1>
          <p className="text-[#444] text-xs mt-2">
            Vehicle maintenance, under control.
          </p>
        </div>

        {/* Decorative divider */}
        <div className="w-20 h-px bg-gradient-to-r from-transparent via-[#00e5ff30] to-transparent" />

        {/* CTA */}
        <div className="w-full flex flex-col gap-3">
          <Button
            className="w-full text-xs tracking-widest"
            onClick={() => void handleSignIn()}
            disabled={loading || isSigningIn}
          >
            {isSigningIn ? 'SIGNING IN...' : 'SIGN IN WITH GOOGLE'}
          </Button>

          {signInError && (
            <p className="text-destructive text-xs text-center">
              {signInError}
            </p>
          )}
        </div>

        <p className="text-[#333] text-[0.5rem] text-center">
          By signing in you agree to our Terms of Service
        </p>
      </div>
    </main>
  );
}
