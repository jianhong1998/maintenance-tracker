// import { execSync } from 'node:child_process';
import { wipeEmulator } from './fixtures/emulator';

export default async function globalSetup() {
  // 1. Wipe all emulator users so test runs start from a clean slate.
  await wipeEmulator();

  // TODO: This is wrong approach. Refactor this.
  // 2. Reset the database. We delegate to the existing just recipe rather
  // than re-implementing it here. This requires the host to have `just`
  // available — true in dev and in the CI machine executor.
  // if (process.env.E2E_SKIP_DB_RESET !== 'true') {
  //   execSync('just db-data-reset', { stdio: 'inherit' });
  // }
}
