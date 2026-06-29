import { describe, expect, it } from "vitest";
import { buildDemoPositions } from "./demoPlanSeed";
import { applyEvents } from "./planningData";

describe("planningData applyEvents", () => {
  it("индексация с февраля не меняет январский оклад", () => {
    const positions = buildDemoPositions(40).map(applyEvents);
    const indexed = positions.find(
      (position) =>
        position.status === "Occupied" &&
        position.activeFromMonth === 0 &&
        position.events.some((event) => event.type === "INDEXATION" && event.payload.month === 1),
    );
    expect(indexed).toBeTruthy();
    expect(indexed!.monthlyBase[0]).toBe(indexed!.seedMonthlyBase[0]);
    expect(indexed!.monthlyBase[11]).toBeGreaterThan(indexed!.monthlyBase[0]);
  });

  it("нормализует укороченные seed-массивы до 12 месяцев", () => {
    const [source] = buildDemoPositions(1);
    const broken = {
      ...source,
      seedMonthlyBase: [180_000],
      seedMonthlyBonus: [0],
      seedMonthlySpec: ["Engineering"],
      seedMonthlyLevel: ["Senior"],
      events: [],
    };
    const applied = applyEvents(broken);
    expect(applied.monthlyBase).toHaveLength(12);
    expect(applied.monthlyBase[11]).toBe(180_000);
  });
});
