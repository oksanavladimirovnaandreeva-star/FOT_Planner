import { describe, expect, it } from "vitest";
import { buildCorrectionLimitImpact } from "./planCorrectionCompare";
import type { PositionRecord } from "../types";

function position(partial: Partial<PositionRecord> & Pick<PositionRecord, "positionId">): PositionRecord {
  const base = Array(12).fill(100_000);
  return {
    positionId: partial.positionId,
    role: "Engineer",
    department: "Engineering",
    unit: "ProductDev",
    team: "Frontend Web",
    slotType: "new",
    limitFlag: "IN_LIMIT",
    activeFromMonth: 0,
    vacancySinceMonth: null,
    previousDecemberBase: 90_000,
    employeeName: null,
    employeeId: null,
    status: "Vacancy",
    seedEmployeeName: null,
    seedEmployeeId: null,
    seedStatus: "Vacancy",
    seedVacancySinceMonth: null,
    monthlySpec: Array(12).fill("Engineering"),
    monthlyLevel: Array(12).fill("Middle"),
    monthlyBase: base,
    monthlyBonus: Array(12).fill(0),
    seedMonthlySpec: Array(12).fill("Engineering"),
    seedMonthlyLevel: Array(12).fill("Middle"),
    seedMonthlyBase: base,
    seedMonthlyBonus: Array(12).fill(0),
    events: [],
    ...partial,
  } as PositionRecord;
}

describe("buildCorrectionLimitImpact", () => {
  it("считает дельту ФОТ по лимиту", () => {
    const baseline = [position({ positionId: "П001", limitFlag: "IN_LIMIT" })];
    const draft = [
      position({ positionId: "П001", limitFlag: "IN_LIMIT", monthlyBase: Array(12).fill(110_000) }),
      position({ positionId: "П002", limitFlag: "OVER_LIMIT" }),
    ];
    const impact = buildCorrectionLimitImpact(baseline, draft);
    const inLimit = impact.byLimit.find((row) => row.limitFlag === "IN_LIMIT");
    const overLimit = impact.byLimit.find((row) => row.limitFlag === "OVER_LIMIT");
    expect(inLimit?.headcountDelta).toBe(0);
    expect(inLimit?.fotDelta).toBe(120_000);
    expect(overLimit?.headcountDelta).toBe(1);
    expect(overLimit?.fotDelta).toBe(1_200_000);
    expect(impact.newOverLimitPositions).toBeGreaterThanOrEqual(1);
  });

  it("фиксирует смену limitFlag", () => {
    const baseline = [position({ positionId: "П001", limitFlag: "IN_LIMIT" })];
    const draft = [position({ positionId: "П001", limitFlag: "OVER_LIMIT" })];
    const impact = buildCorrectionLimitImpact(baseline, draft);
    expect(impact.limitFlagChanges).toHaveLength(1);
    expect(impact.limitFlagChanges[0].baselineFlag).toBe("IN_LIMIT");
    expect(impact.limitFlagChanges[0].draftFlag).toBe("OVER_LIMIT");
  });
});
