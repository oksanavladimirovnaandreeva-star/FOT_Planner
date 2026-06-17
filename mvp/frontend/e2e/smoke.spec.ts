import { test, expect } from "./fixtures";

const ROUTES: { path: string; heading: RegExp }[] = [
  { path: "/", heading: /Обзор и итого/ },
  { path: "/planning", heading: /Планирование ФОТ/ },
  { path: "/analytics", heading: /Аналитика/ },
  { path: "/versions", heading: /Версии и согласование/ },
  { path: "/settings", heading: /Настройки/ },
];

test.describe("smoke: основные маршруты", () => {
  for (const route of ROUTES) {
    test(`${route.path} открывается`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page).toHaveTitle(/ФОТ-планировщик/);
      await expect(page.getByRole("heading", { level: 1, name: route.heading })).toBeVisible();
      await expect(page.getByText("ФОТ-планировщик", { exact: true })).toBeVisible();
    });
  }
});

test("legacy-редиректы работают", async ({ page }) => {
  await page.goto("/consolidation");
  await expect(page).toHaveURL(/\/versions\?tab=consolidation/);
  await expect(page.getByRole("heading", { level: 1, name: /Версии и согласование/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ход планирования" })).toHaveClass(/active/);

  await page.goto("/plan-vs-actual");
  await expect(page).toHaveURL(/\/analytics/);
  await expect(page.getByRole("heading", { level: 1, name: /Аналитика/ })).toBeVisible();
});
