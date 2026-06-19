import { describe, expect, it } from "vitest";
import {
  availableTeamsForSlice,
  availableUnitsForSlice,
  matchesOrgSlice,
  pruneOrgSlice,
  updateOrgSliceDepartments,
} from "./orgSliceFilters";

import {
  DEMO_DEPT_HR,
  DEMO_DEPT_IT,
  DEMO_DEPT_SALES,
  DEMO_TEAM_PLATFORM,
  DEMO_UNIT_A,
} from "./demoOrg";

describe("orgSliceFilters", () => {
  const position = { department: DEMO_DEPT_IT, unit: DEMO_UNIT_A, team: DEMO_TEAM_PLATFORM };

  it("пустые массивы = все", () => {
    expect(matchesOrgSlice(position, { departments: [], units: [], teams: [] })).toBe(true);
  });

  it("фильтрует по нескольким департаментам", () => {
    const slice = { departments: [DEMO_DEPT_IT, DEMO_DEPT_SALES], units: [], teams: [] };
    expect(matchesOrgSlice(position, slice)).toBe(true);
    expect(matchesOrgSlice({ ...position, department: DEMO_DEPT_HR }, slice)).toBe(false);
  });

  it("обрезает юниты при смене департамента", () => {
    const next = updateOrgSliceDepartments(
      { departments: [DEMO_DEPT_IT], units: [DEMO_UNIT_A], teams: [DEMO_TEAM_PLATFORM] },
      [DEMO_DEPT_SALES],
    );
    expect(next.departments).toEqual([DEMO_DEPT_SALES]);
    expect(next.units).toEqual([]);
    expect(next.teams).toEqual([]);
  });

  it("списки опций учитывают выбранные департаменты", () => {
    const units = availableUnitsForSlice({ departments: [DEMO_DEPT_IT] });
    expect(units).toContain(DEMO_UNIT_A);
    const teams = availableTeamsForSlice({ departments: [DEMO_DEPT_IT], units: [DEMO_UNIT_A] });
    expect(teams).toContain(DEMO_TEAM_PLATFORM);
  });

  it("pruneOrgSlice убирает невалидные значения", () => {
    const pruned = pruneOrgSlice({
      departments: [DEMO_DEPT_IT],
      units: [DEMO_UNIT_A, "Unknown"],
      teams: [DEMO_TEAM_PLATFORM, "Unknown"],
    });
    expect(pruned.units).toEqual([DEMO_UNIT_A]);
    expect(pruned.teams).toEqual([DEMO_TEAM_PLATFORM]);
  });
});
