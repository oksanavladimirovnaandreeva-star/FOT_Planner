import { describe, expect, it } from "vitest";
import { buildTeamApprovalDiff } from "./teamApprovalDiff";
import { buildDemoQuarterlyVersionState } from "./demoVersionSeed";
import { isBudgetLocked } from "./planVersions";
import { DEMO_DEPT_IT, DEMO_TEAM_MOBILE, DEMO_TEAM_PLATFORM, DEMO_UNIT_A } from "./demoOrg";

describe("buildDemoQuarterlyVersionState", () => {
  it("создаёт утверждённый v1 и квартальный черновик с правками", () => {
    const { versions, dataByVersion } = buildDemoQuarterlyVersionState();
    const annual = versions.find((version) => version.versionNumber === 1);
    const draft = versions.find((version) => version.kind === "WORKING_DRAFT");

    expect(annual).toBeTruthy();
    expect(annual && isBudgetLocked(annual)).toBe(true);
    expect(draft).toBeTruthy();
    expect(draft?.baselineVersionId).toBe(annual?.id);

    const baseline = dataByVersion[annual!.id];
    const draftRows = dataByVersion[draft!.id];
    expect(baseline.length).toBeGreaterThan(0);
    expect(draftRows.length).toBe(baseline.length);

    const mobileDiff = buildTeamApprovalDiff({
      baselinePositions: baseline,
      draftPositions: draftRows,
      department: DEMO_DEPT_IT,
      unit: DEMO_UNIT_A,
      team: DEMO_TEAM_MOBILE,
      mode: "quarterly",
    });
    expect(mobileDiff.rows.length).toBeGreaterThan(0);

    const frontendDiff = buildTeamApprovalDiff({
      baselinePositions: baseline,
      draftPositions: draftRows,
      department: DEMO_DEPT_IT,
      unit: DEMO_UNIT_A,
      team: DEMO_TEAM_PLATFORM,
      mode: "quarterly",
    });
    expect(frontendDiff.rows.length).toBeGreaterThan(0);
  });
});
