import { test, expect } from '../fixtures/auth.fixture';
import { apiCreateVehicle } from '../fixtures/api';

test.describe('E2 — Mileage prompt submit', () => {
  test('prompt disappears, header mileage updates, and vehicle name remains visible (bug #001 regression guard)', async ({
    page,
    loginAs,
  }) => {
    const user = await loginAs(page);
    // Per architecture §5 / §12: a freshly-created vehicle has
    // mileageLastUpdatedAt = null because only recordMileage sets it.
    // That null is what triggers the daily mileage prompt to render.
    const vehicle = await apiCreateVehicle(user.idToken, {
      brand: 'Audi',
      model: 'A4',
      colour: 'Grey',
      mileage: 60000,
    });

    await page.goto(`/vehicles/${vehicle.id}`);

    const promptInput = page.getByPlaceholder('Enter mileage');
    await expect(promptInput).toBeVisible();

    await promptInput.fill('60500');
    await page.getByRole('button', { name: /^OK$/ }).click();

    await expect(promptInput).toBeHidden();

    // Bug #001 regression guard: heading + meta line BOTH stay visible after
    // the recordMileage cache invalidation.
    await expect(page.getByRole('heading', { name: /Audi A4/i })).toBeVisible();
    await expect(page.getByTestId('vehicle-meta-line')).toHaveText(
      /Grey · 60,500 km/,
    );
  });
});
