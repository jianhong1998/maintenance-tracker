import { test, expect } from '../fixtures/auth.fixture';
import { apiCreateCard, apiCreateVehicle } from '../fixtures/api';

test.describe('D1 — Mark done, mileage-based card', () => {
  test('next-due shifts forward and vehicle mileage updates on the detail header', async ({
    page,
    loginAs,
  }) => {
    const user = await loginAs(page);
    const vehicle = await apiCreateVehicle(user.idToken, {
      brand: 'Nissan',
      model: 'Leaf',
      colour: 'Cyan',
      mileage: 40000,
    });
    await apiCreateCard(user.idToken, vehicle.id, {
      type: 'task',
      name: 'Tyre Rotation',
      intervalMileage: 5000,
      nextDueMileage: 45000,
    });

    await page.goto(`/vehicles/${vehicle.id}`);
    await expect(page.getByText('5,000 km left')).toBeVisible();

    await page.getByRole('button', { name: /actions/i }).click();
    await page.getByRole('menuitem', { name: /^Mark Done$/ }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(/Mark as Done/i);

    await dialog.getByPlaceholder('Current odometer reading').fill('45000');
    await dialog.getByRole('button', { name: /^Done$/ }).click();
    await expect(dialog).toBeHidden();

    // After mark-done with doneAtMileage=45000, vehicle mileage updates to 45000
    // and nextDueMileage becomes 45000 + 5000 = 50000 → 5,000 km left.
    const heading = page.getByRole('heading', { name: /Nissan Leaf/i });
    await expect(heading.locator('..')).toContainText(/Cyan · 45,000 km/);
    await expect(page.getByText('5,000 km left')).toBeVisible();
  });
});
