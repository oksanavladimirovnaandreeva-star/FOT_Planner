import { describe, expect, it } from "vitest";
import { applyEvents, initialPositions } from "./planningData";
import { pinDemoPersonasToRoster } from "./demoRosterPins";
import { formatRosterBrief, rosterSummaryForTeam, summarizeTeamRosters } from "./teamRosterSummary";
import { DEMO_DEPT_IT, DEMO_TEAM_MOBILE, DEMO_UNIT_A } from "./demoOrg";

describe("teamRosterSummary", () => {
  const positions = pinDemoPersonasToRoster(initialPositions().map(applyEvents));

  it("считает состав команды по позициям", () => {
    const summary = rosterSummaryForTeam(positions, DEMO_DEPT_IT, DEMO_UNIT_A, DEMO_TEAM_MOBILE);
    expect(summary).not.toBeNull();
    expect(summary!.occupied).toBeGreaterThan(0);
    expect(summary!.memberNames.length).toBeGreaterThan(0);
    expect(formatRosterBrief(summary)).toContain("в штате");
  });

  it("summarizeTeamRosters фильтрует по юниту", () => {
    const map = summarizeTeamRosters(positions, { department: DEMO_DEPT_IT, unit: DEMO_UNIT_A });
    expect(map.size).toBeGreaterThan(0);
    for (const entry of map.values()) {
      expect(entry.unit).toBe(DEMO_UNIT_A);
    }
  });
});
