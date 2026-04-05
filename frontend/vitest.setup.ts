import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Expose vitest's `vi` as `jest` so @testing-library/dom's jestFakeTimersAreEnabled()
// detects fake timers and advances them automatically inside waitFor().
// Without this, waitFor polls via setTimeout which fake timers intercept and freeze.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).jest = vi;
