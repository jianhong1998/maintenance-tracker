import { test, expect } from '../fixtures/auth.fixture';
import { apiCreateCard, apiCreateVehicle, apiGetCards } from '../fixtures/api';

test.describe('C3 — Edit card', () => {
  test('row reflects the new name and the new interval is persisted', async ({
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

    await dialog.getByPlaceholder('e.g. Oil Change').fill('Wheel Alignment');
    await dialog.getByPlaceholder('e.g. 5000').fill('10000');

    await dialog.getByRole('button', { name: /^Save$/ }).click();
    await expect(dialog).toBeHidden();

    await expect(page.getByText('Wheel Alignment')).toBeVisible();
    await expect(page.getByText('Tyre Rotation')).toHaveCount(0);

    // API readback: per architecture §5, PATCH does not recompute next_due_*,
    // so the interval change is observable only via data. This is the gate
    // the test name promises ("name AND interval reflected").
    const cards = await apiGetCards(user.idToken, vehicle.id);
    expect(cards).toHaveLength(1);
    expect(cards[0].name).toBe('Wheel Alignment');
    expect(cards[0].intervalMileage).toBe(10000);
  });
});
