import { test as base, type Page } from "@playwright/test";

const ROLE_STORAGE_KEY = "fot_mvp_user_role";

export async function seedAdminRole(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    localStorage.setItem(key, "admin");
  }, ROLE_STORAGE_KEY);
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await seedAdminRole(page);
    await use(page);
  },
});

export { expect } from "@playwright/test";
