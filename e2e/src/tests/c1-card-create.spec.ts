import { test, expect } from '../fixtures/auth.fixture';
import { apiCreateVehicle } from '../fixtures/api';

test.describe('C1 — Create card on vehicle with no cards', () => {
  test('the new card row appears with an auto-calculated next-due mileage label', async ({
    page,
    loginAs,
  }) => {
    const user = await loginAs(page);
    const vehicle = await apiCreateVehicle(user.idToken, {
      brand: 'Subaru',
      model: 'Forester',
      colour: 'Green',
      mileage: 20000,
    });

    await page.goto(`/vehicles/${vehicle.id}`);
    await expect(page.getByText(/No maintenance cards yet/i)).toBeVisible();

    await page.getByRole('button', { name: /Add maintenance card/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(/New Maintenance Card/i);

    await dialog.getByPlaceholder('e.g. Oil Change').fill('Oil Change');
    await dialog.getByPlaceholder('e.g. 5000').fill('5000');
    await dialog.getByPlaceholder('e.g. 6').fill('6');

    await dialog.getByRole('button', { name: /^Save$/ }).click();
    await expect(dialog).toBeHidden();

    // New card row visible — vehicleMileage 20000 + interval 5000 = 25000 km left
    await expect(page.getByText(/Oil Change/)).toBeVisible();
    await expect(page.getByText(/5,000 km left/)).toBeVisible();
  });
});
