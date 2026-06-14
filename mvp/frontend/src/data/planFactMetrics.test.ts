import { describe, expect, it } from "vitest";
import {
  planFactDelta,
  planFactEconomyAndOverspendTotals,
  varianceTone,
} from "./planFactMetrics";
import { applyEvents, initialPositions } from "./planningData";

describe("planFactMetrics deltas", () => {
  it("planFactDelta: плюс — экономия, минус — перерасход", () => {
    expect(planFactDelta(100, 80)).toBe(20);
    expect(varianceTone(20)).toBe("under");
    expect(planFactDelta(100, 130)).toBe(-30);
    expect(varianceTone(-30)).toBe("over");
  });

  it("planFactEconomyAndOverspendTotals на демо без факта — нули", () => {
    const positions = initialPositions().map(applyEvents);
    const totals = planFactEconomyAndOverspendTotals(positions, "base");
    expect(totals.economy).toBe(0);
    expect(totals.overspend).toBe(0);
  });
});
