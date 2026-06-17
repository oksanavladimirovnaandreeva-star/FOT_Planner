import { test, expect } from "./fixtures";

test.describe("планирование: таблица и drawer", () => {
  test("клик по строке позиции открывает карточку", async ({ page }) => {
    await page.goto("/planning");

    await expect(page.getByRole("heading", { level: 1, name: /Планирование ФОТ/ })).toBeVisible();

    const firstRow = page.getByTitle("Открыть карточку позиции").first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();

    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("heading", { level: 2 })).toBeVisible();
    await expect(drawer.getByText("Позиция", { exact: true })).toBeVisible();
    await expect(drawer.getByRole("button", { name: "Закрыть" })).toBeVisible();
  });

  test("drawer закрывается кнопкой «Закрыть»", async ({ page }) => {
    await page.goto("/planning");

    await page.getByTitle("Открыть карточку позиции").first().click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();

    await drawer.getByRole("button", { name: "Закрыть" }).click();
    await expect(drawer).toBeHidden();
  });
});

test("матрица по месяцам: клик по позиции открывает карточку", async ({ page }) => {
  await page.goto("/planning?tab=matrix");

  const firstPosition = page.locator(".plan-matrix__pos-btn").first();
  await expect(firstPosition).toBeVisible();
  await firstPosition.click();

  await expect(page.getByRole("dialog")).toBeVisible();
});
