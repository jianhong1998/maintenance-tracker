import { test, expect } from '../fixtures/auth.fixture';
import { apiCreateCard, apiCreateVehicle } from '../fixtures/api';

test.describe('F1 — Overdue mileage shows red', () => {
  test('card with nextDueMileage <= vehicleMileage renders an overdue row with "X km past due"', async ({
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

    // The row container — not just the label — must turn red. data-status is
    // the explicit row-level contract that maps to bg/border colour classes
    // in maintenance-card-row.tsx::getContainerClass. Filter by card name so
    // that future F-series specs seeding multiple cards on the same vehicle
    // don't trip Playwright strict-mode (mirrors G1's pattern).
    const row = page
      .getByTestId('maintenance-card-row')
      .filter({ hasText: 'Coolant Flush' });
    await expect(row).toHaveAttribute('data-status', 'overdue');

    // Lock case to match the implementation (lowercase "past due").
    // Frontend convention "Never break userspace": code emits lowercase, so
    // the test pins lowercase. The test-cases doc has been updated to match.
    await expect(row.getByText('5,000 km past due')).toBeVisible();
  });
});
