import { describe, expect, it } from "vitest";
import { monthAmountForPosition } from "./dashboardMetrics";
import { applyEvents, initialPositions } from "./planningData";
import { buildPlanMonthCell, planAmountAtMonth } from "./planMonthMatrix";
import { isPlanClosedAtMonth } from "./occupancyTimeline";
import type { PositionRecord } from "../types";

function positionWithClose(month: number): PositionRecord {
  const positions = initialPositions();
  return {
    ...positions[0],
    events: [
      {
        id: "e-close",
        type: "CLOSE_POSITION",
        createdAt: new Date().toISOString(),
        createdOrder: 1,
        payload: { month },
      },
    ],
  };
}

describe("buildPlanMonthCell", () => {
  it("закрытая позиция — без плана в ячейке", () => {
    const applied = applyEvents(positionWithClose(5));
    const cell = buildPlanMonthCell(applied, 6, "total");
    expect(cell.planStatus).toBe("Closed");
    expect(cell.planAmount).toBe(0);
    expect(cell.deviation).toBe("closed");
  });

  it("до месяца сокращения план сохраняется", () => {
    const applied = applyEvents(positionWithClose(5));
    const before = buildPlanMonthCell(applied, 4, "total");
    expect(before.planStatus).not.toBe("Closed");
    expect(before.planAmount).toBeGreaterThan(0);
    expect(before.deviation).not.toBe("closed");
  });

  it("с месяца сокращения — Closed, без Δ план−факт", () => {
    const applied = applyEvents(positionWithClose(5));
    expect(isPlanClosedAtMonth(applied, 5)).toBe(true);
    const atClose = buildPlanMonthCell(applied, 5, "total");
    expect(atClose.planStatus).toBe("Closed");
    expect(atClose.planAmount).toBe(0);
    expect(atClose.deviation).toBe("closed");
    expect(atClose.deltaPlanMinusFact).toBe(0);
  });
});

describe("planAmountAtMonth / monthAmountForPosition", () => {
  it("сокращение с июня: янв–май > 0, с июня 0", () => {
    const applied = applyEvents(positionWithClose(5));
    expect(planAmountAtMonth(applied, 4, "total")).toBeGreaterThan(0);
    expect(planAmountAtMonth(applied, 5, "total")).toBe(0);
    expect(monthAmountForPosition(applied, 4, "total")).toBeGreaterThan(0);
    expect(monthAmountForPosition(applied, 5, "total")).toBe(0);
  });
});
