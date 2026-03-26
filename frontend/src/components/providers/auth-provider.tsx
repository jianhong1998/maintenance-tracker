'use client';

import { useEffect, useState } from 'react';
import {
  type User,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { initFirebase, getFirebaseAuth } from '@/lib/firebase';
import { getFirebaseConfig } from '@/actions/firebase-config';
import { AuthContext } from '@/contexts/auth-context';
import { setAuthTokenGetter } from '@/lib/api-client';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<Error | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let settled = false;

    async function init() {
      try {
        const config = await getFirebaseConfig();
        const auth = initFirebase(config);

        setAuthTokenGetter(async () => {
          const currentUser = auth.currentUser;
          if (!currentUser) return null;
          return await currentUser.getIdToken();
        });

        unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
          setUser(firebaseUser);
          setLoading(false);
        });
      } catch (err) {
        if (!settled) {
          setAuthError(
            err instanceof Error
              ? err
              : new Error('Failed to initialize Firebase'),
          );
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      settled = true;
      unsubscribe?.();
      setAuthTokenGetter(() => Promise.resolve(null));
    };
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(getFirebaseAuth(), provider);
  };

  const signOut = async () => {
    await firebaseSignOut(getFirebaseAuth());
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, authError, signInWithGoogle, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
