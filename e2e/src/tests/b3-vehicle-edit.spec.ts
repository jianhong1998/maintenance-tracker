import { test, expect } from '../fixtures/auth.fixture';
import { apiCreateVehicle } from '../fixtures/api';

test.describe('B3 — Edit vehicle', () => {
  test('detail header shows updated colour and mileage, and other vehicle info stays visible (bug #001 regression guard)', async ({
    page,
    loginAs,
  }) => {
    const user = await loginAs(page);
    const vehicle = await apiCreateVehicle(user.idToken, {
      brand: 'Honda',
      model: 'Civic',
      colour: 'Blue',
      mileage: 50000,
    });

    await page.goto(`/vehicles/${vehicle.id}`);
    await expect(
      page.getByRole('heading', { name: /Honda Civic/i }),
    ).toBeVisible();

    await page.getByRole('button', { name: /Edit vehicle/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(/Edit Vehicle/i);
    await expect(page.locator('#vehicle-brand')).toHaveValue('Honda');
    await expect(page.locator('#vehicle-model')).toHaveValue('Civic');
    await expect(page.locator('#vehicle-colour')).toHaveValue('Blue');
    await expect(page.locator('#vehicle-mileage')).toHaveValue('50000');

    await page.locator('#vehicle-colour').fill('Red');
    await page.locator('#vehicle-mileage').fill('51000');

    await dialog.getByRole('button', { name: /^Save$/ }).click();
    await expect(dialog).toBeHidden();

    const heading = page.getByRole('heading', { name: /Honda Civic/i });
    await expect(heading).toBeVisible();
    await expect(heading.locator('..')).toContainText(/Red · 51,000 km/);
  });
});
