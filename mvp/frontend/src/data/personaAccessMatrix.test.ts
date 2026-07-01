import { describe, expect, it } from "vitest";
import { buildAccessScope, normalizeAccessScope } from "./personaAccessScope";
import {
  countPositionsForScope,
  isSimpleOrgScope,
  orgMatrixRowFromScope,
  scopeFromOrgMatrixRow,
} from "./personaAccessMatrix";
import type { PositionRecord } from "../types";

function position(overrides: Partial<PositionRecord>): PositionRecord {
  return {
    positionId: "P1",
    role: "Dev",
    department: "ИТ",
    unit: "Юнит А",
    team: "Платформа",
    status: "Occupied",
    slotType: "carryover",
    limitFlag: "IN_LIMIT",
    employeeId: "E1",
    employeeName: "Тест",
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
    seedEmployeeId: "E1",
    previousDecemberBase: 100_000,
    activeFromMonth: 0,
    ...overrides,
  };
}

describe("personaAccessMatrix", () => {
  it("roundtrip: орг-срез + исключить себя", () => {
    const row = {
      departments: ["ИТ"],
      units: ["Юнит А"],
      teams: ["Платформа"],
      excludeSelf: true,
    };
    const scope = scopeFromOrgMatrixRow(row, "Василий Андреев");
    expect(isSimpleOrgScope(scope, "Василий Андреев")).toBe(true);
    expect(orgMatrixRowFromScope(scope, "Василий Андреев")).toEqual(row);
  });

  it("isSimpleOrgScope: false для сложного neq ФИО", () => {
    const scope = normalizeAccessScope({
      rules: [
        { id: "1", field: "department", operator: "eq", values: ["ИТ"] },
        { id: "2", field: "employeeName", operator: "neq", values: ["А", "Б"] },
      ],
    });
    expect(isSimpleOrgScope(scope, "А")).toBe(false);
  });

  it("countPositionsForScope", () => {
    const positions = [
      position({ employeeName: "Василий Андреев" }),
      position({ employeeName: "Инженер", positionId: "P2" }),
    ];
    const scope = scopeFromOrgMatrixRow(
      { departments: ["ИТ"], units: ["Юнит А"], teams: ["Платформа"], excludeSelf: true },
      "Василий Андреев",
    );
    expect(countPositionsForScope(positions, scope)).toBe(1);
  });

  it("пустой срез — все открытые позиции", () => {
    const positions = [position({}), position({ status: "Closed", positionId: "P2" })];
    expect(countPositionsForScope(positions, buildAccessScope({}))).toBe(1);
  });
});
