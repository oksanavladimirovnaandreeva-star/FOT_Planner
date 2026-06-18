import { describe, expect, it } from "vitest";
import { buildDemoPositions } from "./demoPlanSeed";
import { applyEvents } from "./planningData";

describe("planningData applyEvents", () => {
  it("для стабильной позиции декабрьский оклад равен январскому", () => {
    const positions = buildDemoPositions(40).map(applyEvents);
    const stable = positions.find(
      (position) =>
        position.status === "Occupied" &&
        position.activeFromMonth === 0 &&
        !position.events.some((event) => ["CLOSE_POSITION", "INDEXATION", "MANUAL_OVERRIDE"].includes(event.type)),
    );
    expect(stable).toBeTruthy();
    expect(stable!.monthlyBase[0]).toBeGreaterThan(0);
    expect(stable!.monthlyBase[11]).toBe(stable!.monthlyBase[0]);
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
