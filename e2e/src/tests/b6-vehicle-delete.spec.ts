import { test, expect } from '../fixtures/auth.fixture';
import { apiCreateVehicle } from '../fixtures/api';

test.describe('B6 — Delete vehicle', () => {
  test('confirming delete redirects to home and removes the vehicle from the grid', async ({
    page,
    loginAs,
  }) => {
    const user = await loginAs(page);
    const vehicle = await apiCreateVehicle(user.idToken, {
      brand: 'Mazda',
      model: 'MX-5',
      colour: 'Yellow',
      mileage: 8000,
    });

    await page.goto(`/vehicles/${vehicle.id}`);
    await page.getByRole('button', { name: /Delete vehicle/i }).click();

    const confirm = page.getByRole('dialog');
    await expect(confirm).toContainText(/Delete Vehicle/i);
    await expect(confirm).toContainText(/Mazda MX-5/);

    await confirm.getByRole('button', { name: /^Delete$/ }).click();

    await page.waitForURL((url) => url.pathname === '/');
    await expect(page.getByRole('link', { name: /Mazda MX-5/i })).toHaveCount(
      0,
    );
  });
});
