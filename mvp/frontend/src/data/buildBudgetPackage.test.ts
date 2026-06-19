import { describe, expect, it } from "vitest";
import { buildBudgetPackage, groupChangesByType } from "./buildBudgetPackage";
import type { PositionRecord } from "../types";
import type { PlanVersionMeta } from "./planVersions";

function basePosition(overrides: Partial<PositionRecord> = {}): PositionRecord {
  return {
    positionId: "P001",
    role: "Dev",
    department: "Engineering",
    unit: "ProductDev",
    team: "Frontend Web",
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

function version(partial: Partial<PlanVersionMeta>): PlanVersionMeta {
  return {
    id: "v1",
    label: "v1",
    planYear: 2026,
    versionNumber: 1,
    kind: "APPROVED",
    status: "APPROVED",
    parentVersionId: null,
    baselineVersionId: null,
    createdAt: "",
    publishedAt: new Date().toISOString(),
    ...partial,
  };
}

describe("groupChangesByType", () => {
  it("агрегирует строки по типу события", () => {
    const groups = groupChangesByType([
      {
        positionId: "P1",
        role: "Dev",
        department: "Engineering",
        unit: "ProductDev",
        team: "Mobile",
        typeLabel: "Пересмотр",
        employeeLine: null,
        change: {} as never,
        comment: null,
        isNewPosition: false,
        fotDeltaAnnual: 50_000,
        event: {} as never,
        createdAt: "",
      },
      {
        positionId: "P2",
        role: "Dev",
        department: "Engineering",
        unit: "ProductDev",
        team: "Mobile",
        typeLabel: "Пересмотр",
        employeeLine: null,
        change: {} as never,
        comment: "note",
        isNewPosition: false,
        fotDeltaAnnual: 30_000,
        event: {} as never,
        createdAt: "",
      },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].changeCount).toBe(2);
    expect(groups[0].fotDeltaAnnual).toBe(80_000);
  });
});

describe("buildBudgetPackage", () => {
  const primary = version({ id: "b1", label: "Бюджет 2026", versionNumber: 1, status: "APPROVED" });
  const draftVersion = version({
    id: "d1",
    label: "1 Квартал 2026",
    versionNumber: 2,
    kind: "WORKING_DRAFT",
    status: "DRAFT",
    publishedAt: undefined,
  });

  it("собирает пакет юнита с командами и журналом", () => {
    const baseline = [
      basePosition({ team: "Mobile", positionId: "P1" }),
      basePosition({ team: "Frontend Web", positionId: "P2" }),
    ];
    const draft = [
      basePosition({
        team: "Mobile",
        positionId: "P1",
        events: [
          {
            id: "ev1",
            type: "TARGET_SALARY",
            payload: { month: 5, base: 120_000 },
            createdAt: "2026-06-01",
            createdOrder: 1,
          },
        ],
        monthlyBase: Array(12).fill(120_000),
      }),
      basePosition({ team: "Frontend Web", positionId: "P2" }),
    ];

    const pkg = buildBudgetPackage({
      level: "unit",
      department: "Engineering",
      unit: "ProductDev",
      scopeLabel: "юнит ProductDev",
      positions: draft,
      baselinePositions: baseline,
      draftPositions: draft,
      workingDraft: draftVersion,
      primaryBudget: primary,
      versionDiffSummary: {
        baselineLabel: "Бюджет 2026",
        draftLabel: "1 Квартал 2026",
        baselineHeadcount: 2,
        draftHeadcount: 2,
        headcountDelta: 0,
        baselineAnnualFot: 0,
        draftAnnualFot: 0,
        annualFotDelta: 0,
        baselineDecPrev: 0,
        draftDecPrev: 0,
        baselineDecPlan: 0,
        draftDecPlan: 0,
        decGrowthDeltaPp: 0,
      },
    });

    expect(pkg.teams.length).toBeGreaterThanOrEqual(2);
    expect(pkg.journalRows.length).toBe(1);
    expect(pkg.changesByType.length).toBe(1);
    expect(pkg.totals.draftFot).toBeGreaterThan(0);
  });
});
