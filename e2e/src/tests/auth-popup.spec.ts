import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

test('user can sign in via Google popup against the emulator', async ({
  page,
  context,
}) => {
  await page.goto('/login');

  const popupPromise = context.waitForEvent('page');
  await page.getByRole('button', { name: /sign in with google/i }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');

  // Emulator stub picker exposes an "Add new account" button that opens a
  // form to create a Google identity on the fly.
  await popup.getByRole('button', { name: /add new account/i }).click();
  const email = `popup-${randomUUID()}@test.local`;
  await popup.getByLabel(/email/i).fill(email);
  await popup.getByLabel(/display name/i).fill('Popup Tester');
  await popup
    .getByRole('button', { name: /sign in with google\.com/i })
    .click();
  await popup.waitForEvent('close');

  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
  await expect(
    page.getByRole('link', { name: /fleet/i }).first(),
  ).toBeVisible();
});
