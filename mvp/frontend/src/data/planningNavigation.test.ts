import { describe, expect, it } from "vitest";
import { applyEvents } from "./planningData";
import { buildDemoAnnualVersionState } from "./demoVersionSeed";
import { matchesOrgSlice } from "./orgSliceFilters";
import { matchesLeadOnlyFilter } from "./personaRoster";
import { applyPlanningDeepLinkSlice } from "./planningDeepLink";
import { planUnitLeadContourPath } from "./planWorkspaceMode";
import { DEMO_DEPT_IT, DEMO_UNIT_A } from "./demoOrg";

describe("planning navigation from budget contour", () => {
  it("директор → Сидор: deep-link и фильтр дают одну позицию", () => {
    const { dataByVersion, versions } = buildDemoAnnualVersionState();
    const positions = (dataByVersion[versions[0]!.id] ?? []).map(applyEvents);

    const href = planUnitLeadContourPath(DEMO_UNIT_A, "planning", DEMO_DEPT_IT);
    const url = new URL(href, "http://localhost");
    const orgSlice = applyPlanningDeepLinkSlice(
      { departments: [], units: [], teams: [] },
      {
        team: url.searchParams.get("team"),
        unit: url.searchParams.get("unit"),
        department: url.searchParams.get("department"),
      },
      null,
    );

    const leadOnly = url.searchParams.get("leadOnly");
    const filtered = positions.filter(
      (position) =>
        matchesOrgSlice(position, orgSlice) &&
        matchesLeadOnlyFilter(position, leadOnly === "unit_lead" ? "unit_lead" : null),
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.employeeName).toBe("Сидор Морозов");
  });
});
