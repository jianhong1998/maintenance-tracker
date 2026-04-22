import { test as base, type Page } from '@playwright/test';
import { createEmulatorUser, type EmulatorUser } from './emulator';

type AuthFixtures = {
  loginAs: (page: Page) => Promise<EmulatorUser>;
};

export const test = base.extend<AuthFixtures>({
  // eslint-disable-next-line no-empty-pattern
  loginAs: async ({}, use) => {
    await use(async (page) => {
      const user = await createEmulatorUser();
      await page.goto('/login');
      // window.__e2eAuth is exposed by frontend/src/lib/firebase.ts when the
      // emulator is connected. Production builds do not expose it.
      await page.waitForFunction(
        () =>
          typeof (window as unknown as { __e2eAuth?: unknown }).__e2eAuth !==
          'undefined',
      );
      await page.evaluate(
        async ({ email, password }) => {
          await (
            window as unknown as {
              __e2eAuth: {
                signIn: (e: string, p: string) => Promise<void>;
              };
            }
          ).__e2eAuth.signIn(email, password);
        },
        { email: user.email, password: user.password },
      );
      await page.waitForURL((url) => !url.pathname.startsWith('/login'));
      return user;
    });
  },
});

export { expect } from '@playwright/test';
