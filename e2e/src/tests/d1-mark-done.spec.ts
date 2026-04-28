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

    // Seed values chosen so the "X km left" label CHANGES across mark-done.
    //   pre:  nextDue 45000 - vehicle 40000 = 5,000 km left
    //   post: nextDue 45000+7000 = 52000, vehicle 45000 → 7,000 km left
    // Identical pre/post labels would make this test unable to distinguish a
    // silent mutation no-op from a real success.
    await apiCreateCard(user.idToken, vehicle.id, {
      type: 'task',
      name: 'Tyre Rotation',
      intervalMileage: 7000,
      nextDueMileage: 45000,
    });

    await page.goto(`/vehicles/${vehicle.id}`);
    await expect(page.getByText('5,000 km left')).toBeVisible();

    await page.getByRole('button', { name: /actions/i }).click();
    await page.getByRole('menuitem', { name: /^Mark Done$/ }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(/Mark as Done/i);

    // The mileage field is required and starts empty. Asserting the empty
    // initial value pins down current UX (no pre-fill) — see test-cases D1.
    const mileageInput = dialog.getByPlaceholder('Current odometer reading');
    await expect(mileageInput).toHaveValue('');
    await mileageInput.fill('45000');
    await dialog.getByRole('button', { name: /^Done$/ }).click();
    await expect(dialog).toBeHidden();

    // Bug #001 regression guard: heading + meta line BOTH stay visible after
    // the mark-done cache invalidation.
    await expect(
      page.getByRole('heading', { name: /Nissan Leaf/i }),
    ).toBeVisible();
    await expect(page.getByTestId('vehicle-meta-line')).toHaveText(
      /Cyan · 45,000 km/,
    );

    // Label change is the only honest UI gate that the mutation succeeded:
    // 5,000 km left → 7,000 km left. Asserting the new value AND the absence
    // of the old one prevents stale-state false positives.
    await expect(page.getByText('7,000 km left')).toBeVisible();
    await expect(page.getByText('5,000 km left')).toHaveCount(0);
  });
});
