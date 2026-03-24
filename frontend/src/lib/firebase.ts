import { getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

export function validateFirebaseEnv(): void {
  const missing = [
    'FRONTEND_FIREBASE_API_KEY',
    'FRONTEND_FIREBASE_AUTH_DOMAIN',
    'FRONTEND_FIREBASE_PROJECT_ID',
  ].filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required Firebase environment variables: ${missing.join(', ')}`,
    );
  }
}

validateFirebaseEnv();

const firebaseConfig = {
  apiKey: process.env.FRONTEND_FIREBASE_API_KEY,
  authDomain: process.env.FRONTEND_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FRONTEND_FIREBASE_PROJECT_ID,
};

const app =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
