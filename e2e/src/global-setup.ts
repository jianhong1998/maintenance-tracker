import { wipeEmulator } from './fixtures/emulator';

export default async function globalSetup() {
  // Wipe all emulator users so test runs start from a clean slate.
  // Per-test state isolation: each test creates its own emulator user via
  // createEmulatorUser(). Because Vehicle, MaintenanceCard, and
  // MaintenanceHistory are user-scoped (FK to User), a fresh user yields a
  // fresh data set without any DB-level reset.
  //
  // Add a real DB reset here only when one of the following becomes true:
  //  - A spec asserts global state (feature flags, config thresholds).
  //  - A spec asserts cross-user aggregation (e.g. fleet-wide reporting).
  //  - F-series warning tests start mutating shared rows.
  // The replacement should be a backend-side reset endpoint guarded by
  // BACKEND_ENABLE_MOCK_AUTH, not a child-process shell-out to `just`.
  await wipeEmulator();
}
