import { test, expect } from '../fixtures/auth.fixture';
import { apiCreateCard, apiCreateVehicle } from '../fixtures/api';

test.describe('F1 — Overdue mileage shows red', () => {
  test('card with nextDueMileage <= vehicleMileage renders an overdue (red) row with "X km past due"', async ({
    page,
    loginAs,
  }) => {
    const user = await loginAs(page);
    const vehicle = await apiCreateVehicle(user.idToken, {
      brand: 'Volvo',
      model: 'XC60',
      colour: 'Black',
      mileage: 80000,
    });
    await apiCreateCard(user.idToken, vehicle.id, {
      type: 'task',
      name: 'Coolant Flush',
      intervalMileage: 30000,
      nextDueMileage: 75000, // 5000 km behind current mileage of 80000
    });

    await page.goto(`/vehicles/${vehicle.id}`);

    const overdueLabel = page.getByText(/5,000 km past due/i);
    await expect(overdueLabel).toBeVisible();
    await expect(overdueLabel).toHaveClass(/text-\[#ff4444\]/);
  });
});
