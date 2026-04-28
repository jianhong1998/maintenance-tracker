import { test, expect } from '../fixtures/auth.fixture';
import { apiCreateVehicle, apiGetVehicleStatus } from '../fixtures/api';

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

    const confirmDialog = page.getByRole('dialog');
    await expect(confirmDialog).toContainText(/Delete Vehicle/i);
    await expect(confirmDialog).toContainText(/Mazda MX-5/);

    await confirmDialog.getByRole('button', { name: /^Delete$/ }).click();

    await page.waitForURL((url) => url.pathname === '/');
    await expect(
      page.getByTestId('vehicle-card-link').filter({ hasText: /Mazda MX-5/ }),
    ).toHaveCount(0);

    // API-side verification: the vehicle is gone from the database.
    expect(await apiGetVehicleStatus(user.idToken, vehicle.id)).toBe(404);
  });
});
