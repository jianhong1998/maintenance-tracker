import { getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

export function validateFirebaseEnv(): void {
  const missing = [
    ['FRONTEND_FIREBASE_API_KEY', process.env.FRONTEND_FIREBASE_API_KEY],
    [
      'FRONTEND_FIREBASE_AUTH_DOMAIN',
      process.env.FRONTEND_FIREBASE_AUTH_DOMAIN,
    ],
    ['FRONTEND_FIREBASE_PROJECT_ID', process.env.FRONTEND_FIREBASE_PROJECT_ID],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Missing required Firebase environment variables: ${missing.join(', ')}`,
    );
  }
}

const isClient = typeof window !== 'undefined';

if (isClient) {
  validateFirebaseEnv();
}

const firebaseConfig = {
  apiKey: process.env.FRONTEND_FIREBASE_API_KEY,
  authDomain: process.env.FRONTEND_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FRONTEND_FIREBASE_PROJECT_ID,
};

const app = isClient
  ? getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApps()[0]
  : null;

export const auth = (isClient ? getAuth(app!) : null) as ReturnType<
  typeof getAuth
>;
