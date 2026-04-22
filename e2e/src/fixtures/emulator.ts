import { randomUUID } from 'node:crypto';
import axios from 'axios';

const PROJECT_ID =
  process.env.E2E_FIREBASE_PROJECT_ID ?? 'maintenance-tracker-e2e';
const EMULATOR_HOST =
  process.env.E2E_FIREBASE_AUTH_EMULATOR_HOST ?? 'localhost:9099';

const SIGN_UP_URL = `http://${EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`;
const WIPE_URL = `http://${EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`;

export type EmulatorUser = {
  email: string;
  password: string;
  uid: string;
  idToken: string;
};

export async function createEmulatorUser(): Promise<EmulatorUser> {
  const email = `e2e-${randomUUID()}@test.local`;
  const password = 'test-password';
  const res = await axios.post<{ idToken: string; localId: string }>(
    SIGN_UP_URL,
    { email, password, returnSecureToken: true },
  );
  return { email, password, uid: res.data.localId, idToken: res.data.idToken };
}

export async function wipeEmulator(): Promise<void> {
  await axios.delete(WIPE_URL);
}
