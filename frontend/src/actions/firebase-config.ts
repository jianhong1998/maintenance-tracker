'use server';

export type FirebaseClientConfig = {
  apiKey: string | undefined;
  authDomain: string | undefined;
  projectId: string | undefined;
  authEmulatorHost: string | undefined;
};

export async function getFirebaseConfig(): Promise<FirebaseClientConfig> {
  const enableMockAuth = process.env.FRONTEND_ENABLE_MOCK_AUTH === 'true';

  let authEmulatorHost: string | undefined;
  if (enableMockAuth) {
    const host = process.env.FRONTEND_FIREBASE_AUTH_EMULATOR_HOST;
    if (!host) {
      throw new Error(
        'FRONTEND_ENABLE_MOCK_AUTH is true but FRONTEND_FIREBASE_AUTH_EMULATOR_HOST is not set',
      );
    }
    authEmulatorHost = host;
  }

  return {
    apiKey: process.env.FRONTEND_FIREBASE_API_KEY,
    authDomain: process.env.FRONTEND_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FRONTEND_FIREBASE_PROJECT_ID,
    authEmulatorHost,
  };
}
