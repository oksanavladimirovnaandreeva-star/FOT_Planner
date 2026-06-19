import { describe, expect, it, beforeEach, vi } from "vitest";
import { buildDemoAnnualVersionState } from "./demoVersionSeed";
import { buildBudgetPackage } from "./buildBudgetPackage";
import { buildBudgetContour } from "./buildBudgetContour";
import { loginAsDemoPersona } from "./demoSessionStore";
import { DEMO_DEPT_IT, DEMO_UNIT_A } from "./demoOrg";
import type { PlanVersionDiffSummary } from "./planVersionDiff";

describe("buildBudgetContour", () => {
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
      clear: () => {
        memory.clear();
      },
    });
  });

  it("строит плитки команд с ссылкой на планирование", () => {
    loginAsDemoPersona("sidr");
    const { versions, dataByVersion } = buildDemoAnnualVersionState();
    const primary = versions[0]!;
    const positions = dataByVersion[primary.id]!;
    const emptyDiff: PlanVersionDiffSummary = {
      baselineLabel: primary.label,
      draftLabel: primary.label,
      baselineHeadcount: 0,
      draftHeadcount: 0,
      headcountDelta: 0,
      baselineAnnualFot: 0,
      draftAnnualFot: 0,
      annualFotDelta: 0,
      baselineDecPrev: 0,
      draftDecPrev: 0,
      baselineDecPlan: 0,
      draftDecPlan: 0,
      decGrowthDeltaPp: 0,
    };
    const pkg = buildBudgetPackage({
      level: "unit",
      department: DEMO_DEPT_IT,
      unit: DEMO_UNIT_A,
      scopeLabel: `юнит ${DEMO_UNIT_A}`,
      positions,
      baselinePositions: positions,
      draftPositions: positions,
      workingDraft: null,
      primaryBudget: primary,
      versionDiffSummary: emptyDiff,
      submissionMode: "annual",
    });

    const contour = buildBudgetContour({
      level: "unit",
      department: DEMO_DEPT_IT,
      unit: DEMO_UNIT_A,
      teams: pkg.teams,
      positions,
      directReportPersonaIds: ["vasya", "petya"],
    });

    expect(contour.title).toBe("Ваш контур");
    expect(contour.unitGroups[0]?.teams.length).toBe(pkg.teams.length);
    const directTiles = contour.unitGroups[0]?.teams.filter((tile) => tile.isDirectReport) ?? [];
    expect(directTiles.length).toBeGreaterThanOrEqual(2);
    expect(contour.unitGroups[0]?.teams[0]?.leadPlanningHref).toContain("leadOnly=1");
    expect(contour.unitGroups[0]?.teams[0]?.leadPlanningHref).toContain("unit=");
    expect(contour.unitGroups[0]?.teams[0]?.planningHref).toContain("team=");
  });

  it("директор: пакет департамента с ненулевым ФОТ", () => {
    loginAsDemoPersona("dir_it");
    const { versions, dataByVersion } = buildDemoAnnualVersionState();
    const primary = versions[0]!;
    const positions = dataByVersion[primary.id]!;
    const emptyDiff: PlanVersionDiffSummary = {
      baselineLabel: primary.label,
      draftLabel: primary.label,
      baselineHeadcount: 0,
      draftHeadcount: 0,
      headcountDelta: 0,
      baselineAnnualFot: 0,
      draftAnnualFot: 0,
      annualFotDelta: 0,
      baselineDecPrev: 0,
      draftDecPrev: 0,
      baselineDecPlan: 0,
      draftDecPlan: 0,
      decGrowthDeltaPp: 0,
    };
    const pkg = buildBudgetPackage({
      level: "department",
      department: DEMO_DEPT_IT,
      unit: null,
      scopeLabel: `департамент ${DEMO_DEPT_IT}`,
      positions,
      baselinePositions: positions,
      draftPositions: positions,
      workingDraft: null,
      primaryBudget: primary,
      versionDiffSummary: emptyDiff,
      submissionMode: "annual",
    });

    expect(pkg.teams.length).toBeGreaterThan(0);
    expect(pkg.totals.draftFot).toBeGreaterThan(0);
    expect(pkg.teams.some((team) => team.draftFotAnnual > 0)).toBe(true);

    const contour = buildBudgetContour({
      level: "department",
      department: DEMO_DEPT_IT,
      unit: null,
      teams: pkg.teams,
      positions,
    });
    const unitTile = contour.unitGroups.find((group) => group.unit === "Юнит Б")?.teams[0];
    expect(unitTile?.leadPlanningHref).toContain("leadOnly=unit_lead");
    expect(unitTile?.leadPlanningHref).toContain("unit=");
  });
});
