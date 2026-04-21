import { test, expect } from "../fixtures/auth.fixture";

test("user can log in and see the dashboard shell", async ({
  page,
  loginAs,
}) => {
  await loginAs(page);
  // Dashboard shell renders the Fleet nav item — assert it's visible.
  await expect(
    page.getByRole("link", { name: /fleet/i }).first(),
  ).toBeVisible();
});
