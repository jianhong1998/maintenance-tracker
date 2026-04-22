import { randomUUID } from 'node:crypto';
import axios from 'axios';

const PROJECT_ID = 'maintenance-tracker-e2e';
const EMULATOR_HOST =
  process.env.FIREBASE_AUTH_EMULATOR_HOST ?? 'localhost:9099';

const SIGN_UP_URL = `http://${EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`;

type EmulatorSignUpResponse = {
  idToken: string;
  refreshToken: string;
  email: string;
  localId: string;
};

export type TestUser = {
  email: string;
  idToken: string;
  uid: string;
};

/**
 * Mints a fresh user via the Firebase Auth Emulator's open REST endpoint.
 * The emulator accepts any `key` query param. Returns an ID token suitable
 * for `Authorization: Bearer ...` against the backend (which is also pointed
 * at the same emulator).
 */
export async function createTestUser(): Promise<TestUser> {
  const email = `api-test-${randomUUID()}@test.local`;
  const password = 'test-password';

  const res = await axios.post<EmulatorSignUpResponse>(SIGN_UP_URL, {
    email,
    password,
    returnSecureToken: true,
  });

  return { email, idToken: res.data.idToken, uid: res.data.localId };
}

export function authHeaders(user: TestUser) {
  return { headers: { Authorization: `Bearer ${user.idToken}` } };
}

/** Wipes every user in the emulator. Call between suites if you need a clean slate. */
export async function wipeEmulator(): Promise<void> {
  await axios.delete(
    `http://${EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`,
  );
}
