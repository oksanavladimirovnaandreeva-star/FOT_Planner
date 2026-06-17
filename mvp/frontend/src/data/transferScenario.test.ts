import { describe, expect, it } from "vitest";
import {
  formatTransferVacancyLabel,
  listMaternityReplacementCandidates,
  listTransferVacancyTargets,
  pickTransferVacancyTargets,
} from "./transferScenario";
import type { PositionRecord } from "../types";

function position(partial: Partial<PositionRecord> & Pick<PositionRecord, "positionId">): PositionRecord {
  const base: PositionRecord = {
    positionId: partial.positionId,
    role: "Role",
    department: "Engineering",
    unit: "Core",
    team: "Team A",
    status: "Vacancy",
    seedStatus: "Vacancy",
    slotType: "carryover",
    limitFlag: "IN_LIMIT",
    employeeId: null,
    employeeName: null,
    activeFromMonth: 0,
    vacancySinceMonth: 0,
    seedVacancySinceMonth: 0,
    previousDecemberBase: 100_000,
    monthlyBase: Array(12).fill(100_000),
    monthlyBonus: Array(12).fill(0),
    monthlySpec: Array(12).fill("Engineering"),
    monthlyLevel: Array(12).fill("Middle"),
    events: [],
  };
  return { ...base, ...partial };
}

describe("transferScenario", () => {
  it("listTransferVacancyTargets filters by department, unit, team and vacancy month", () => {
    const plan = [
      position({ positionId: "SRC", status: "Occupied", seedStatus: "Occupied", employeeId: "e1", employeeName: "A" }),
      position({ positionId: "V1", department: "Product", unit: "Core", team: "PM A" }),
      position({ positionId: "V2", department: "Product", unit: "Core", team: "PM B" }),
      position({
        positionId: "OCC",
        department: "Product",
        unit: "Core",
        team: "PM A",
        status: "Occupied",
        seedStatus: "Occupied",
        employeeId: "e2",
        employeeName: "B",
      }),
    ];

    expect(
      listTransferVacancyTargets(plan, "SRC", 0, { department: "Product", unit: "Core", team: "PM A" }).map(
        (item) => item.positionId,
      ),
    ).toEqual(["V1"]);

    expect(
      listTransferVacancyTargets(plan, "SRC", 0, { department: "Product", unit: "Core" }).map((item) => item.positionId),
    ).toEqual(["V1", "V2"]);
  });

  it("formatTransferVacancyLabel includes org and role", () => {
    const label = formatTransferVacancyLabel(position({ positionId: "POS-1", role: "Backend" }));
    expect(label).toContain("POS-1");
    expect(label).toContain("Core / Team A");
    expect(label).toContain("Backend");
  });

  it("listMaternityReplacementCandidates keeps same department and excludes primary", () => {
    const plan = [
      position({
        positionId: "P1",
        status: "Occupied",
        seedStatus: "Occupied",
        employeeId: "e1",
        employeeName: "Primary",
        department: "Engineering",
      }),
      position({
        positionId: "P2",
        status: "Occupied",
        seedStatus: "Occupied",
        employeeId: "e2",
        employeeName: "Replacement",
        department: "Engineering",
        unit: "Platform",
        team: "API",
      }),
      position({
        positionId: "P3",
        status: "Occupied",
        seedStatus: "Occupied",
        employeeId: "e3",
        employeeName: "Other dept",
        department: "Product",
      }),
    ];
    const options = [
      { employeeId: "e1", employeeName: "Primary", positionId: "P1" },
      { employeeId: "e2", employeeName: "Replacement", positionId: "P2" },
      { employeeId: "e3", employeeName: "Other dept", positionId: "P3" },
    ];

    const rows = listMaternityReplacementCandidates(plan, options, {
      employeeId: "e1",
      department: "Engineering",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.employeeId).toBe("e2");
  });

  it("pickTransferVacancyTargets relaxes team filter when team is empty", () => {
    const plan = [
      position({ positionId: "SRC", status: "Occupied", seedStatus: "Occupied", employeeId: "e1", employeeName: "A" }),
      position({ positionId: "V1", department: "Product", unit: "Core", team: "PM B" }),
    ];
    const result = pickTransferVacancyTargets(plan, "SRC", 0, {
      department: "Product",
      unit: "Core",
      team: "PM A",
    });
    expect(result.relaxedFromTeam).toBe(true);
    expect(result.options.map((item) => item.positionId)).toEqual(["V1"]);
  });
});
