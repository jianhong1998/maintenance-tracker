import { test, expect } from '../fixtures/auth.fixture';

test.describe('A1 — Login success', () => {
  test('unauthenticated user is redirected to /login, signs in, lands on / with fleet visible', async ({
    page,
    loginAs,
  }) => {
    await page.goto('/');
    await page.waitForURL((url) => url.pathname === '/login');

    await loginAs(page);

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(/FLEET OVERVIEW/i)).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /Your Vehicles/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /\+ ADD VEHICLE/i }),
    ).toBeVisible();
  });
});
