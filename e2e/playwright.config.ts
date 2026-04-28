import { defineConfig, devices } from '@playwright/test';

const FRONTEND_URL = process.env.E2E_FRONTEND_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './src/tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './src/global-setup.ts',
  use: {
    baseURL: FRONTEND_URL,
    // Lock the browser locale so Intl.NumberFormat group separators (the
    // comma in "12,345 km" assertions across b1/b3/c1/d1/e2/f1/g1) stay
    // deterministic regardless of the host/CI image default.
    locale: 'en-US',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
