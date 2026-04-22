import { getApps, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  signInWithEmailAndPassword,
  type Auth,
} from 'firebase/auth';

let _auth: Auth | null = null;

export type InitFirebaseConfig = {
  apiKey: string | undefined;
  authDomain: string | undefined;
  projectId: string | undefined;
  authEmulatorHost: string | undefined;
};

export function initFirebase(config: InitFirebaseConfig): Auth {
  if (_auth) return _auth;

  const required = {
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
  };
  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    throw new Error(`Missing required Firebase config: ${missing.join(', ')}`);
  }

  // getApps()[0] reuses an existing app (e.g. across HMR cycles in dev).
  const app = getApps().length === 0 ? initializeApp(required) : getApps()[0];
  _auth = getAuth(app);

  if (config.authEmulatorHost) {
    connectAuthEmulator(_auth, `http://${config.authEmulatorHost}`, {
      disableWarnings: true,
    });
    exposeE2ESignInHelper(_auth);
  }

  return _auth;
}

export function getFirebaseAuth(): Auth {
  if (!_auth)
    throw new Error(
      'Firebase has not been initialized. Call initFirebase() first.',
    );
  return _auth;
}

// Exposed only when `authEmulatorHost` is set — a runtime-only gate derived
// from FRONTEND_ENABLE_MOCK_AUTH + FRONTEND_FIREBASE_AUTH_EMULATOR_HOST. Prod
// containers never set those, so the helper never appears in prod at runtime.
// Intentionally not gated on NODE_ENV: pipeline E2E runs against the real prod
// frontend image (NODE_ENV=production after `next build`) and still needs this
// helper to drive programmatic sign-in.
function exposeE2ESignInHelper(auth: Auth): void {
  if (typeof window === 'undefined') return;
  (
    window as unknown as {
      __e2eAuth: { signIn: (email: string, password: string) => Promise<void> };
    }
  ).__e2eAuth = {
    signIn: async (email, password) => {
      await signInWithEmailAndPassword(auth, email, password);
    },
  };
}
