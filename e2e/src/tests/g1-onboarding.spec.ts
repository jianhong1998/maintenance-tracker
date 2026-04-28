import { test, expect } from '../fixtures/auth.fixture';

test.describe('G1 — Full onboarding (composite)', () => {
  test('login → empty fleet → add vehicle → navigate → add 2 cards (mileage-only and date-only) and each renders with correct status', async ({
    page,
    loginAs,
  }) => {
    await loginAs(page);
    await page.goto('/');

    // 1. Empty fleet: no vehicle cards rendered yet, and the empty-state
    // affordance is present. Asserting both is what makes this a true
    // composite test of the onboarding journey instead of a vehicle-create
    // test in disguise.
    await expect(page.getByTestId('vehicle-card-link')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: /\+ ADD VEHICLE/i }),
    ).toBeVisible();

    // 2. Add vehicle.
    await page.getByRole('button', { name: /\+ ADD VEHICLE/i }).click();
    let dialog = page.getByRole('dialog');
    await page.locator('#vehicle-brand').fill('Tesla');
    await page.locator('#vehicle-model').fill('Model 3');
    await page.locator('#vehicle-colour').fill('White');
    await page.locator('#vehicle-mileage').fill('1000');
    await dialog.getByRole('button', { name: /^Save$/ }).click();
    await expect(dialog).toBeHidden();

    // 3. Navigate into the vehicle.
    await page
      .getByTestId('vehicle-card-link')
      .filter({ hasText: /Tesla Model 3/ })
      .click();
    await page.waitForURL(/\/vehicles\/[^/]+/);
    await expect(
      page.getByRole('heading', { name: /Tesla Model 3/i }),
    ).toBeVisible();

    // 4. Mileage-only card.
    await page.getByRole('button', { name: /Add maintenance card/i }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder('e.g. Oil Change').fill('Battery Inspection');
    await dialog.getByPlaceholder('e.g. 5000').fill('20000');
    await dialog.getByRole('button', { name: /^Save$/ }).click();
    await expect(dialog).toBeHidden();

    const mileageRow = page
      .getByTestId('maintenance-card-row')
      .filter({ hasText: 'Battery Inspection' });
    await expect(mileageRow).toBeVisible();
    await expect(mileageRow).toHaveAttribute('data-status', 'ok');
    await expect(mileageRow).toContainText(/20,000 km left/);
    // Mileage-only card must NOT render a date label.
    await expect(mileageRow.getByText(/days left/i)).toHaveCount(0);

    // 5. Date-only card.
    await page.getByRole('button', { name: /Add maintenance card/i }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder('e.g. Oil Change').fill('Annual Service');
    await dialog.getByPlaceholder('e.g. 6').fill('12');
    await dialog.getByRole('button', { name: /^Save$/ }).click();
    await expect(dialog).toBeHidden();

    const dateRow = page
      .getByTestId('maintenance-card-row')
      .filter({ hasText: 'Annual Service' });
    await expect(dateRow).toBeVisible();
    await expect(dateRow).toHaveAttribute('data-status', 'ok');
    // 12 months from today ≈ 365 days. ±1 day for month-boundary arithmetic.
    await expect(dateRow.getByText(/(364|365|366) days left/)).toBeVisible();
    // Date-only card must NOT render a mileage label.
    await expect(dateRow.getByText(/km left/i)).toHaveCount(0);
  });
});
