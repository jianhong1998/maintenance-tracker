import { test, expect } from '../fixtures/auth.fixture';
import { apiCreateCard, apiCreateVehicle } from '../fixtures/api';

test.describe('C4 — Delete card', () => {
  test('row disappears after confirming delete', async ({ page, loginAs }) => {
    const user = await loginAs(page);
    const vehicle = await apiCreateVehicle(user.idToken, {
      brand: 'BMW',
      model: '320i',
      colour: 'White',
      mileage: 30000,
    });
    await apiCreateCard(user.idToken, vehicle.id, {
      type: 'part',
      name: 'Brake Pads',
      intervalMileage: 25000,
      nextDueMileage: 55000,
    });

    await page.goto(`/vehicles/${vehicle.id}`);
    await expect(page.getByText('Brake Pads')).toBeVisible();

    await page.getByRole('button', { name: /actions/i }).click();
    await page.getByRole('menuitem', { name: /^Delete$/ }).click();

    const confirm = page.getByRole('dialog');
    await expect(confirm).toContainText(/Delete Card/i);
    await expect(confirm).toContainText('Brake Pads');

    await confirm.getByRole('button', { name: /^Delete$/ }).click();
    await expect(confirm).toBeHidden();

    await expect(page.getByText('Brake Pads')).toHaveCount(0);
    await expect(page.getByText(/No maintenance cards yet/i)).toBeVisible();
  });
});
