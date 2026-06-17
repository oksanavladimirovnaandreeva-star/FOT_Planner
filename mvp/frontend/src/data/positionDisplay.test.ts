import { describe, expect, it } from "vitest";
import type { PositionRecord } from "../types";
import { formatCrCoefficient, formatPositionOrgLine, positionEmployeePrimaryName } from "./positionDisplay";

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
    previousDecemberBase: 100_000,
    seedEmployeeName: "Иванов",
    seedEmployeeId: "E001",
    seedStatus: "Occupied",
    seedVacancySinceMonth: null,
    monthlySpec: Array(12).fill("Engineering"),
    monthlyLevel: Array(12).fill("Middle"),
    monthlyBase: Array(12).fill(100_000),
    monthlyBonus: Array(12).fill(0),
    seedMonthlySpec: Array(12).fill("Engineering"),
    seedMonthlyLevel: Array(12).fill("Middle"),
    seedMonthlyBase: Array(12).fill(100_000),
    seedMonthlyBonus: Array(12).fill(0),
    events: [],
    ...overrides,
  };
}

describe("positionDisplay", () => {
  it("formatPositionOrgLine по роли", () => {
    const row = sample();
    expect(formatPositionOrgLine(row, "team_lead")).toBe("Frontend Web (P001)");
    expect(formatPositionOrgLine(row, "unit_lead")).toBe("Frontend Web (P001)");
    expect(formatPositionOrgLine(row, "director")).toBe("ProductDev / Frontend Web (P001)");
    expect(formatPositionOrgLine(row, "cb_admin")).toBe("Engineering / ProductDev / Frontend Web (P001)");
  });

  it("positionEmployeePrimaryName для занятой", () => {
    expect(positionEmployeePrimaryName(sample())).toBe("Иванов");
  });

  it("formatCrCoefficient", () => {
    expect(formatCrCoefficient(0.95)).toBe("0.95");
    expect(formatCrCoefficient(0)).toBe("—");
  });
});
