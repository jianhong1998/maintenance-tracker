import { test, expect } from '../fixtures/auth.fixture';

test.describe('B1 — Create vehicle (empty fleet)', () => {
  test('user fills the add-vehicle form and the new card appears on the home grid', async ({
    page,
    loginAs,
  }) => {
    await loginAs(page);
    await page.goto('/');

    await page.getByRole('button', { name: /\+ ADD VEHICLE/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/Add Vehicle/i);

    await page.locator('#vehicle-brand').fill('Toyota');
    await page.locator('#vehicle-model').fill('Corolla');
    await page.locator('#vehicle-colour').fill('Silver');
    await page.locator('#vehicle-mileage').fill('12345');
    // Default unit is km — leave as-is.

    await dialog.getByRole('button', { name: /^Save$/ }).click();
    await expect(dialog).toBeHidden();

    const newCard = page.getByRole('link', { name: /Toyota Corolla/i });
    await expect(newCard).toBeVisible();
    await expect(newCard).toContainText(/Silver/);
    await expect(newCard).toContainText(/12,345 km/);
  });
});
