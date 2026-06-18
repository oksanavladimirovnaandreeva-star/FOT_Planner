import { describe, expect, it } from "vitest";
import type { PositionRecord } from "../types";
import {
  formatPersonaLoginOption,
  buildAccessScope,
  formatAccessScopeBrief,
  orgTargetMatchesAccessScope,
  parseStoredAccessScope,
  positionMatchesAccessScope,
} from "./personaAccessScope";

function samplePosition(overrides: Partial<PositionRecord> = {}): PositionRecord {
  return {
    positionId: "P001",
    role: "Engineer",
    department: "Engineering",
    unit: "ProductDev",
    team: "Frontend Web",
    status: "Occupied",
    employeeName: "Ирина Соколова",
    employeeId: "E001",
    slotType: "new",
    limitFlag: "IN_LIMIT",
    activeFromMonth: 0,
    vacancySinceMonth: null,
    previousDecemberBase: 100_000,
    seedEmployeeName: "Ирина Соколова",
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

describe("personaAccessScope", () => {
  it("мигрирует legacy department/unit/team в правила eq", () => {
    const scope = parseStoredAccessScope({
      department: "Engineering",
      unit: "ProductDev",
      team: "Mobile",
    });
    expect(scope?.rules).toHaveLength(3);
    expect(positionMatchesAccessScope(samplePosition({ team: "Mobile" }), scope!)).toBe(true);
    expect(positionMatchesAccessScope(samplePosition({ team: "Frontend Web" }), scope!)).toBe(false);
  });

  it("поддерживает neq по ФИО для исключения лида", () => {
    const scope = buildAccessScope({
      department: "Engineering",
      unit: "ProductDev",
      team: "Frontend Web",
      excludeEmployeeNames: ["Василий Андреев"],
    });
    expect(
      positionMatchesAccessScope(
        samplePosition({ employeeName: "Василий Андреев", seedEmployeeName: "Василий Андреев" }),
        scope,
      ),
    ).toBe(false);
    expect(positionMatchesAccessScope(samplePosition(), scope)).toBe(true);
  });

  it("поддерживает несколько значений в правиле eq", () => {
    const scope = buildAccessScope({
      department: "Engineering",
      team: ["Frontend Web", "Mobile"],
    });
    expect(positionMatchesAccessScope(samplePosition({ team: "Mobile" }), scope)).toBe(true);
    expect(positionMatchesAccessScope(samplePosition({ team: "Backend Core" }), scope)).toBe(false);
  });

  it("orgTargetMatchesAccessScope игнорирует правила ФИО", () => {
    const scope = buildAccessScope({
      department: "Engineering",
      unit: "ProductDev",
      excludeEmployeeNames: ["Василий Андреев"],
    });
    expect(
      orgTargetMatchesAccessScope(
        { department: "Engineering", unit: "ProductDev", team: "Frontend Web" },
        scope,
      ),
    ).toBe(true);
  });

  it("formatPersonaLoginOption — ФИО и роль", () => {
    expect(formatPersonaLoginOption("Василий Андреев", "Тимлид")).toBe("Василий Андреев — Тимлид");
    expect(formatPersonaLoginOption("Ольга Андреева", "C&B")).toBe("Ольга Андреева — C&B");
  });
});
