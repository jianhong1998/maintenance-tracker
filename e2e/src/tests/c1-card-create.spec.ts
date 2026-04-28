import { test, expect } from '../fixtures/auth.fixture';
import { apiCreateVehicle, apiGetCards } from '../fixtures/api';

const isoDateMonthsFromNow = (months: number): Date => {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d;
};

test.describe('C1 — Create card on vehicle with no cards', () => {
  test('the new card row appears with auto-calculated next-due mileage and date', async ({
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

    // UI side: the row renders with the rounded mileage label.
    await expect(page.getByText(/Oil Change/)).toBeVisible();
    await expect(page.getByText(/5,000 km left/)).toBeVisible();

    // API readback: the spec headline is "auto-calculated next-due VALUES"
    // (mileage AND date). The "X km left" UI label can mathematically reduce
    // back to the interval, so the only honest gate is reading the row.
    const cards = await apiGetCards(user.idToken, vehicle.id);
    expect(cards).toHaveLength(1);
    const [card] = cards;
    expect(card.intervalMileage).toBe(5000);
    expect(card.intervalTimeMonths).toBe(6);
    expect(card.nextDueMileage).toBe(25000); // 20000 + 5000

    // Allow ±2 days of slack for date arithmetic at month boundaries.
    expect(card.nextDueDate).not.toBeNull();
    const expected = isoDateMonthsFromNow(6).getTime();
    const actual = new Date(card.nextDueDate as string).getTime();
    const slack = 2 * 24 * 60 * 60 * 1000;
    expect(Math.abs(actual - expected)).toBeLessThanOrEqual(slack);
  });
});
