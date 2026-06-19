import { describe, expect, it } from "vitest";
import type { PositionRecord } from "../types";
import { positionsUseLegacyOrg } from "./demoStorageMigration";

function position(overrides: Partial<PositionRecord>): PositionRecord {
  return {
    positionId: "P001",
    role: "Dev",
    department: "Департамент ИТ",
    unit: "Юнит А",
    team: "Качество",
    status: "Occupied",
    slotType: "regular",
    limitFlag: "IN_LIMIT",
    employeeId: "E001",
    employeeName: "Test",
    events: [],
    monthlyBase: Array(12).fill(100_000),
    monthlyBonus: Array(12).fill(0),
    monthlySpec: Array(12).fill("Engineering"),
    monthlyLevel: Array(12).fill("Middle"),
    seedMonthlyBase: Array(12).fill(100_000),
    seedMonthlyBonus: Array(12).fill(0),
    seedMonthlySpec: Array(12).fill("Engineering"),
    seedMonthlyLevel: Array(12).fill("Middle"),
    seedStatus: "Occupied",
    seedEmployeeId: "E001",
    ...overrides,
  };
}

describe("demoStorageMigration", () => {
  it("находит устаревшие названия оргструктуры", () => {
    expect(positionsUseLegacyOrg([position({ department: "Engineering" })])).toBe(true);
    expect(positionsUseLegacyOrg([position({ unit: "ProductDev" })])).toBe(true);
    expect(positionsUseLegacyOrg([position({})])).toBe(false);
  });
});
