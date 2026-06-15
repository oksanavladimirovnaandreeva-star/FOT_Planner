import { describe, expect, it } from "vitest";
import type { PositionRecord } from "../types";
import { formatDecGrowthPctLine, resolveDecGrowthDisplay } from "./decGrowthDisplay";

function sample(overrides: Partial<PositionRecord> = {}): PositionRecord {
  return {
    positionId: "P001",
    role: "Engineer",
    department: "Engineering",
    unit: "ProductDev",
    team: "Frontend Web",
    status: "Occupied",
    employeeName: "Иванов",
    employeeId: "E001",
    slotType: "new",
    limitFlag: "IN_LIMIT",
    activeFromMonth: 0,
    vacancySinceMonth: null,
    previousDecemberBase: 0,
    seedEmployeeName: "Иванов",
    seedEmployeeId: "E001",
    seedStatus: "Occupied",
    seedVacancySinceMonth: null,
    monthlySpec: Array(12).fill("Engineering"),
    monthlyLevel: Array(12).fill("Middle"),
    monthlyBase: Array(12).fill(210_000),
    monthlyBonus: Array(12).fill(0),
    seedMonthlySpec: Array(12).fill("Engineering"),
    seedMonthlyLevel: Array(12).fill("Middle"),
    seedMonthlyBase: Array(12).fill(210_000),
    seedMonthlyBonus: Array(12).fill(0),
    events: [],
    ...overrides,
  };
}

describe("decGrowthDisplay", () => {
  it("new position with prev=0 shows n/a label", () => {
    const display = resolveDecGrowthDisplay(sample(), 2026);
    expect(display.label).toBe("new_position");
    expect(formatDecGrowthPctLine(display)).toBe("н/п · новая позиция");
  });

  it("carryover growth pct", () => {
    const display = resolveDecGrowthDisplay(
      sample({ slotType: "carryover", previousDecemberBase: 199_500, monthlyBase: Array(12).fill(210_000) }),
      2026,
    );
    expect(display.label).toBe("growth");
    expect(display.pct).toBeCloseTo(5.26, 1);
  });
});
