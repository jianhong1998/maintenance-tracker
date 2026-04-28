import { test, expect } from '../fixtures/auth.fixture';

test.describe('G1 — Full onboarding (composite)', () => {
  test('login → empty fleet → add vehicle → navigate → add 2 cards (mileage-only and date-only) and each renders with correct status', async ({
    page,
    loginAs,
  }) => {
    await loginAs(page);
    await page.goto('/');

    // 1. Empty fleet → add vehicle.
    await page.getByRole('button', { name: /\+ ADD VEHICLE/i }).click();
    let dialog = page.getByRole('dialog');
    await page.locator('#vehicle-brand').fill('Tesla');
    await page.locator('#vehicle-model').fill('Model 3');
    await page.locator('#vehicle-colour').fill('White');
    await page.locator('#vehicle-mileage').fill('1000');
    await dialog.getByRole('button', { name: /^Save$/ }).click();
    await expect(dialog).toBeHidden();

    // 2. Navigate into the vehicle.
    await page.getByRole('link', { name: /Tesla Model 3/i }).click();
    await page.waitForURL(/\/vehicles\/[^/]+/);
    await expect(
      page.getByRole('heading', { name: /Tesla Model 3/i }),
    ).toBeVisible();

    // 3. Mileage-only card.
    await page.getByRole('button', { name: /Add maintenance card/i }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder('e.g. Oil Change').fill('Battery Inspection');
    await dialog.getByPlaceholder('e.g. 5000').fill('20000');
    await dialog.getByRole('button', { name: /^Save$/ }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Battery Inspection')).toBeVisible();
    await expect(page.getByText(/20,000 km left/)).toBeVisible();

    // 4. Date-only card.
    await page.getByRole('button', { name: /Add maintenance card/i }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder('e.g. Oil Change').fill('Annual Service');
    await dialog.getByPlaceholder('e.g. 6').fill('12');
    await dialog.getByRole('button', { name: /^Save$/ }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Annual Service')).toBeVisible();
    // 12 months = ~365 days. Allow a couple of days of slack for month boundaries.
    await expect(page.getByText(/3\d\d days left/)).toBeVisible();
  });
});
