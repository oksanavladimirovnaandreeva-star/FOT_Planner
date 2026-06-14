import { describe, expect, it } from "vitest";
import type { PositionRecord } from "../types";
import {
  DEMO_ROLE_SCOPE,
  filterPositionsByRole,
  mergeScopedPositionUpdates,
  positionMatchesRole,
  roleCanApplyMassIndexation,
  roleCanEdit,
  roleCanImportFact,
  roleCanManageVersions,
  roleCanToggleLeadFreeze,
  roleOrgFilterDefaults,
} from "./userAccess";

function samplePosition(overrides: Partial<PositionRecord> = {}): PositionRecord {
  return {
    positionId: "P001",
    role: "Engineer",
    department: "Engineering",
    unit: "ProductDev",
    team: "Frontend Web",
    status: "Occupied",
    employeeName: "Test",
    employeeId: "E001",
    slotType: "new",
    limitFlag: "IN_LIMIT",
    activeFromMonth: 0,
    vacancySinceMonth: null,
    previousDecemberBase: 100_000,
    seedEmployeeName: "Test",
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

describe("userAccess RBAC", () => {
  it("team_lead видит только свою команду", () => {
    const inTeam = samplePosition();
    const otherTeam = samplePosition({ team: "Backend", positionId: "П002" });
    const filtered = filterPositionsByRole([inTeam, otherTeam], "team_lead");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].positionId).toBe("P001");
  });

  it("director — срез департамента", () => {
    const eng = samplePosition();
    const sales = samplePosition({ department: "Sales", positionId: "П002" });
    expect(filterPositionsByRole([eng, sales], "director")).toHaveLength(1);
  });

  it("unit_lead — только свой юнит", () => {
    const inUnit = samplePosition();
    const otherUnit = samplePosition({ unit: "Platform", team: "Backend Core", positionId: "П002" });
    const sales = samplePosition({ department: "Sales", unit: "Enterprise", team: "Key Accounts", positionId: "П003" });
    expect(filterPositionsByRole([inUnit, otherUnit, sales], "unit_lead")).toHaveLength(1);
    expect(filterPositionsByRole([inUnit, otherUnit], "unit_lead")[0].unit).toBe("ProductDev");
  });

  it("freeze блокирует team_lead и unit_lead, не director", () => {
    expect(roleCanEdit("team_lead", true)).toBe(false);
    expect(roleCanEdit("unit_lead", true)).toBe(false);
    expect(roleCanEdit("director", true)).toBe(true);
    expect(roleCanEdit("admin", true)).toBe(true);
  });

  it("viewer не редактирует", () => {
    expect(roleCanEdit("viewer", false)).toBe(false);
  });

  it("C&B admin: версии и факт", () => {
    expect(roleCanManageVersions("admin")).toBe(true);
    expect(roleCanManageVersions("director")).toBe(false);
    expect(roleCanImportFact("admin")).toBe(true);
    expect(roleCanImportFact("unit_lead")).toBe(false);
  });

  it("freeze toggle — director и admin", () => {
    expect(roleCanToggleLeadFreeze("director")).toBe(true);
    expect(roleCanToggleLeadFreeze("admin")).toBe(true);
    expect(roleCanToggleLeadFreeze("team_lead")).toBe(false);
  });

  it("массовая индексация для C&B и unit_lead", () => {
    expect(roleCanApplyMassIndexation("team_lead")).toBe(false);
    expect(roleCanApplyMassIndexation("director")).toBe(false);
    expect(roleCanApplyMassIndexation("unit_lead")).toBe(true);
    expect(roleCanApplyMassIndexation("admin")).toBe(true);
  });

  it("team_lead и unit_lead фиксируют фильтры оргструктуры", () => {
    const teamDefaults = roleOrgFilterDefaults("team_lead");
    expect(teamDefaults?.departments).toEqual([DEMO_ROLE_SCOPE.team_lead.department]);
    expect(teamDefaults?.lockTeam).toBe(true);
    const unitDefaults = roleOrgFilterDefaults("unit_lead");
    expect(unitDefaults?.units).toEqual([DEMO_ROLE_SCOPE.unit_lead.unit]);
    expect(unitDefaults?.lockUnit).toBe(true);
    expect(unitDefaults?.lockTeam).toBe(false);
    expect(roleOrgFilterDefaults("director")).toBeNull();
  });

  it("mergeScopedPositionUpdates не трогает позиции вне среза", () => {
    const scoped = samplePosition({ positionId: "П001", monthlyBase: Array(12).fill(200_000) });
    const outside = samplePosition({ positionId: "П099", department: "Sales", team: "X" });
    const all = [outside, samplePosition()];
    const merged = mergeScopedPositionUpdates(all, [samplePosition()], [scoped]);
    expect(merged.find((p) => p.positionId === "П099")?.department).toBe("Sales");
    expect(merged.find((p) => p.positionId === "П001")?.monthlyBase[0]).toBe(200_000);
  });

  it("positionMatchesRole для team_lead", () => {
    expect(positionMatchesRole(samplePosition(), "team_lead")).toBe(true);
    expect(positionMatchesRole(samplePosition({ team: "Other" }), "team_lead")).toBe(false);
  });
});
