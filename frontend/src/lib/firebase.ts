import { getApps, initializeApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

let _auth: Auth | null = null;

export function initFirebase(config: {
  apiKey: string | undefined;
  authDomain: string | undefined;
  projectId: string | undefined;
}): Auth {
  if (_auth) return _auth;

  const missing = Object.entries(config)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    throw new Error(`Missing required Firebase config: ${missing.join(', ')}`);
  }

  // getApps()[0] reuses an existing app (e.g. across HMR cycles in dev).
  // This is intentional — we always own the first Firebase app in this project.
  const app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
  _auth = getAuth(app);
  return _auth;
}

export function getFirebaseAuth(): Auth {
  if (!_auth)
    throw new Error(
      'Firebase has not been initialized. Call initFirebase() first.',
    );
  return _auth;
}
