import { test, expect } from "./fixtures";

test.describe("навигация в сайдбаре", () => {
  test("переходы по основным пунктам меню", async ({ page }) => {
    await page.goto("/");

    const nav = page.getByRole("navigation", { name: "Основное меню" });

    await nav.getByRole("link", { name: "Планирование" }).click();
    await expect(page).toHaveURL(/\/planning/);
    await expect(page.getByRole("heading", { level: 1, name: /Планирование ФОТ/ })).toBeVisible();

    await nav.getByRole("link", { name: "Аналитика" }).click();
    await expect(page).toHaveURL(/\/analytics/);
    await expect(page.getByRole("heading", { level: 1, name: /Аналитика/ })).toBeVisible();

    await nav.getByRole("link", { name: "Версии" }).click();
    await expect(page).toHaveURL(/\/versions/);
    await expect(page.getByRole("heading", { level: 1, name: /Версии и согласование/ })).toBeVisible();

    await nav.getByRole("link", { name: "Настройки" }).click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByRole("heading", { level: 1, name: /Настройки/ })).toBeVisible();

    await nav.getByRole("link", { name: "Обзор и итого", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1, name: /Обзор и итого/ })).toBeVisible();
  });
});
