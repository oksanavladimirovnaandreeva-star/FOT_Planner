import { describe, expect, it } from "vitest";
import { resolveBudgetWorkspacePositions } from "./resolveBudgetWorkspacePositions";
import { buildDemoAnnualVersionState } from "./demoVersionSeed";
import { applyEvents } from "./planningData";
import { DEMO_DEPT_IT, DEMO_UNIT_A } from "./demoOrg";
import { buildUnitApprovalDiff } from "./teamApprovalDiff";

describe("resolveBudgetWorkspacePositions", () => {
  it("годовой сценарий без квартала — позиции из активного плана", () => {
    const { versions, dataByVersion } = buildDemoAnnualVersionState();
    const annual = versions[0];
    const applied = (dataByVersion[annual.id] ?? []).map(applyEvents);
    const resolved = resolveBudgetWorkspacePositions({
      workingDraft: null,
      primaryBudget: annual,
      versionDiffBaseline: [],
      versionDiffDraft: [],
      appliedPlanPositions: applied,
    });
    expect(resolved.submissionMode).toBe("annual");
    expect(resolved.draftPositions.length).toBeGreaterThan(0);

    const diff = buildUnitApprovalDiff({
      baselinePositions: resolved.baselinePositions,
      draftPositions: resolved.draftPositions,
      department: DEMO_DEPT_IT,
      unit: DEMO_UNIT_A,
      mode: "annual",
    });
    expect(diff.summary.draftFot).toBeGreaterThan(0);
  });
});
