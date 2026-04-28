import { test, expect } from '../fixtures/auth.fixture';
import { apiCreateVehicle } from '../fixtures/api';

test.describe('E2 — Mileage prompt submit', () => {
  test('prompt disappears, header mileage updates, and vehicle name remains visible (bug #001 regression guard)', async ({
    page,
    loginAs,
  }) => {
    const user = await loginAs(page);
    const vehicle = await apiCreateVehicle(user.idToken, {
      brand: 'Audi',
      model: 'A4',
      colour: 'Grey',
      mileage: 60000,
    });

    await page.goto(`/vehicles/${vehicle.id}`);

    const promptInput = page.getByPlaceholder('Enter mileage');
    await expect(promptInput).toBeVisible();
    await expect(page.getByText(/UPDATE ODOMETER/i)).toBeVisible();

    await promptInput.fill('60500');
    await page.getByRole('button', { name: /^OK$/ }).click();

    await expect(promptInput).toBeHidden();
    const heading = page.getByRole('heading', { name: /Audi A4/i });
    await expect(heading).toBeVisible();
    await expect(heading.locator('..')).toContainText(/Grey · 60,500 km/);
  });
});
