/** Отдаёт main thread между тяжёлыми этапами (пилотный набор и т.п.). */
export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });
}
