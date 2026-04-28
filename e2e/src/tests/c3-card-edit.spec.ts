import { test, expect } from '../fixtures/auth.fixture';
import { apiCreateCard, apiCreateVehicle } from '../fixtures/api';

test.describe('C3 — Edit card', () => {
  test('row reflects the new name and interval after editing', async ({
    page,
    loginAs,
  }) => {
    const user = await loginAs(page);
    const vehicle = await apiCreateVehicle(user.idToken, {
      brand: 'Ford',
      model: 'Focus',
      colour: 'Black',
      mileage: 10000,
    });
    await apiCreateCard(user.idToken, vehicle.id, {
      type: 'task',
      name: 'Tyre Rotation',
      intervalMileage: 8000,
      nextDueMileage: 18000,
    });

    await page.goto(`/vehicles/${vehicle.id}`);
    await expect(page.getByText('Tyre Rotation')).toBeVisible();

    await page.getByRole('button', { name: /actions/i }).click();
    await page.getByRole('menuitem', { name: /^Edit$/ }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(/Edit Maintenance Card/i);

    const nameInput = dialog.getByPlaceholder('e.g. Oil Change');
    await nameInput.fill('Wheel Alignment');
    await dialog.getByPlaceholder('e.g. 5000').fill('10000');

    await dialog.getByRole('button', { name: /^Save$/ }).click();
    await expect(dialog).toBeHidden();

    await expect(page.getByText('Wheel Alignment')).toBeVisible();
    await expect(page.getByText('Tyre Rotation')).toHaveCount(0);
  });
});
