import { beforeEach, describe, expect, it, vi } from "vitest";
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
  loadUserRole,
} from "./userAccess";

import {
  DEMO_DEPT_IT,
  DEMO_DEPT_SALES,
  DEMO_TEAM_PLATFORM,
  DEMO_TEAM_SALES_B2B,
  DEMO_UNIT_A,
  DEMO_UNIT_B,
} from "./demoOrg";

function samplePosition(overrides: Partial<PositionRecord> = {}): PositionRecord {
  return {
    positionId: "P001",
    role: "Engineer",
    department: DEMO_DEPT_IT,
    unit: DEMO_UNIT_A,
    team: DEMO_TEAM_PLATFORM,
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
  beforeEach(() => {
    const memory = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    });
  });

  it("team_lead видит только свою команду", () => {
    const inTeam = samplePosition();
    const otherTeam = samplePosition({ team: "Backend", positionId: "П002" });
    const filtered = filterPositionsByRole([inTeam, otherTeam], "team_lead");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].positionId).toBe("P001");
  });

  it("director — срез департамента", () => {
    const eng = samplePosition();
    const sales = samplePosition({ department: DEMO_DEPT_SALES, positionId: "П002" });
    expect(filterPositionsByRole([eng, sales], "director")).toHaveLength(1);
  });

  it("unit_lead — только свой юнит", () => {
    const inUnit = samplePosition();
    const otherUnit = samplePosition({ unit: DEMO_UNIT_B, team: "Backend", positionId: "П002" });
    const sales = samplePosition({
      department: DEMO_DEPT_SALES,
      unit: "Коммерция",
      team: DEMO_TEAM_SALES_B2B,
      positionId: "П003",
    });
    expect(filterPositionsByRole([inUnit, otherUnit, sales], "unit_lead")).toHaveLength(1);
    expect(filterPositionsByRole([inUnit, otherUnit], "unit_lead")[0].unit).toBe(DEMO_UNIT_A);
  });

  it("freeze блокирует team_lead и unit_lead, не director", () => {
    expect(roleCanEdit("team_lead", true)).toBe(false);
    expect(roleCanEdit("unit_lead", true)).toBe(false);
    expect(roleCanEdit("director", true)).toBe(true);
    expect(roleCanEdit("cb_admin", true)).toBe(true);
    expect(roleCanEdit("gd", true)).toBe(true);
  });

  it("viewer не редактирует", () => {
    expect(roleCanEdit("viewer", false)).toBe(false);
  });

  it("C&B admin: версии и факт", () => {
    expect(roleCanManageVersions("cb_admin")).toBe(true);
    expect(roleCanManageVersions("director")).toBe(false);
    expect(roleCanImportFact("cb_admin")).toBe(true);
    expect(roleCanImportFact("unit_lead")).toBe(false);
  });

  it("freeze toggle — director и admin", () => {
    expect(roleCanToggleLeadFreeze("director")).toBe(true);
    expect(roleCanToggleLeadFreeze("cb_admin")).toBe(true);
    expect(roleCanToggleLeadFreeze("gd")).toBe(true);
    expect(roleCanToggleLeadFreeze("team_lead")).toBe(false);
  });

  it("массовая индексация только для C&B", () => {
    expect(roleCanApplyMassIndexation("team_lead")).toBe(false);
    expect(roleCanApplyMassIndexation("director")).toBe(false);
    expect(roleCanApplyMassIndexation("unit_lead")).toBe(false);
    expect(roleCanApplyMassIndexation("cb_admin")).toBe(true);
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

  it("mergeScopedPositionUpdates удаляет позиции из среза", () => {
    const scoped = samplePosition({ positionId: "П001" });
    const outside = samplePosition({ positionId: "П099", department: "Sales", team: "X" });
    const all = [outside, scoped];
    const merged = mergeScopedPositionUpdates(all, [scoped], []);
    expect(merged).toHaveLength(1);
    expect(merged[0].positionId).toBe("П099");
  });

  it("loadUserRole мигрирует legacy admin в cb_admin", () => {
    localStorage.setItem("fot_mvp_user_role", "admin");
    expect(loadUserRole()).toBe("cb_admin");
    expect(localStorage.getItem("fot_mvp_user_role")).toBe("cb_admin");
    localStorage.removeItem("fot_mvp_user_role");
  });

  it("positionMatchesRole для team_lead", () => {
    expect(positionMatchesRole(samplePosition(), "team_lead")).toBe(true);
    expect(positionMatchesRole(samplePosition({ team: "Other" }), "team_lead")).toBe(false);
  });

  it("исключает ФИО лида из среза team_lead", () => {
    localStorage.setItem(
      "fot_mvp_demo_persona_id",
      "vasya",
    );
    localStorage.setItem(
      "fot_mvp_demo_persona_scopes",
      JSON.stringify({
        vasya: {
          rules: [
            { id: "d", field: "department", operator: "eq", values: [DEMO_DEPT_IT] },
            { id: "u", field: "unit", operator: "eq", values: [DEMO_UNIT_A] },
            { id: "t", field: "team", operator: "eq", values: [DEMO_TEAM_PLATFORM] },
            { id: "n", field: "employeeName", operator: "neq", values: ["Василий Андреев"] },
          ],
        },
      }),
    );
    localStorage.setItem("fot_mvp_user_role", "team_lead");
    const leadSelf = samplePosition({
      employeeName: "Василий Андреев",
      seedEmployeeName: "Василий Андреев",
    });
    const teammate = samplePosition({ employeeName: "Ирина Соколова", positionId: "P002" });
    expect(positionMatchesRole(leadSelf, "team_lead")).toBe(false);
    expect(positionMatchesRole(teammate, "team_lead")).toBe(true);
  });
});
