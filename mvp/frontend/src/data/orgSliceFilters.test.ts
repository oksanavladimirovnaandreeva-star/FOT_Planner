import { describe, expect, it } from "vitest";
import {
  availableTeamsForSlice,
  availableUnitsForSlice,
  matchesOrgSlice,
  pruneOrgSlice,
  updateOrgSliceDepartments,
} from "./orgSliceFilters";

describe("orgSliceFilters", () => {
  const position = { department: "Engineering", unit: "ProductDev", team: "Frontend Web" };

  it("пустые массивы = все", () => {
    expect(matchesOrgSlice(position, { departments: [], units: [], teams: [] })).toBe(true);
  });

  it("фильтрует по нескольким департаментам", () => {
    const slice = { departments: ["Engineering", "Sales"], units: [], teams: [] };
    expect(matchesOrgSlice(position, slice)).toBe(true);
    expect(matchesOrgSlice({ ...position, department: "HR" }, slice)).toBe(false);
  });

  it("обрезает юниты при смене департамента", () => {
    const next = updateOrgSliceDepartments(
      { departments: ["Engineering"], units: ["ProductDev"], teams: ["Frontend Web"] },
      ["Sales"],
    );
    expect(next.departments).toEqual(["Sales"]);
    expect(next.units).toEqual([]);
    expect(next.teams).toEqual([]);
  });

  it("списки опций учитывают выбранные департаменты", () => {
    const units = availableUnitsForSlice({ departments: ["Engineering"] });
    expect(units).toContain("ProductDev");
    const teams = availableTeamsForSlice({ departments: ["Engineering"], units: ["ProductDev"] });
    expect(teams).toContain("Frontend Web");
  });

  it("pruneOrgSlice убирает невалидные значения", () => {
    const pruned = pruneOrgSlice({
      departments: ["Engineering"],
      units: ["ProductDev", "Unknown"],
      teams: ["Frontend Web", "Unknown"],
    });
    expect(pruned.units).toEqual(["ProductDev"]);
    expect(pruned.teams).toEqual(["Frontend Web"]);
  });
});
