import { departmentOptions, teamOptions, unitOptions } from "./planningData";

/** Пустой массив на уровне = «все» в этом измерении. */
export type OrgSliceSelection = {
  departments: string[];
  units: string[];
  teams: string[];
};

export const EMPTY_ORG_SLICE: OrgSliceSelection = {
  departments: [],
  units: [],
  teams: [],
};

export function matchesOrgSlice(
  position: { department: string; unit: string; team: string },
  slice: OrgSliceSelection,
): boolean {
  if (slice.departments.length > 0 && !slice.departments.includes(position.department)) return false;
  if (slice.units.length > 0 && !slice.units.includes(position.unit)) return false;
  if (slice.teams.length > 0 && !slice.teams.includes(position.team)) return false;
  return true;
}

export function availableUnitsForSlice(slice: Pick<OrgSliceSelection, "departments">): string[] {
  const depts = slice.departments.length > 0 ? slice.departments : departmentOptions();
  const units = new Set<string>();
  for (const dept of depts) {
    for (const unit of unitOptions(dept)) units.add(unit);
  }
  return [...units].sort((a, b) => a.localeCompare(b, "ru"));
}

export function availableTeamsForSlice(slice: Pick<OrgSliceSelection, "departments" | "units">): string[] {
  const depts = slice.departments.length > 0 ? slice.departments : departmentOptions();
  const teams = new Set<string>();

  if (slice.units.length > 0) {
    for (const dept of depts) {
      for (const unit of slice.units) {
        if (!unitOptions(dept).includes(unit)) continue;
        for (const team of teamOptions(dept, unit)) teams.add(team);
      }
    }
  } else {
    for (const dept of depts) {
      for (const unit of unitOptions(dept)) {
        for (const team of teamOptions(dept, unit)) teams.add(team);
      }
    }
  }

  return [...teams].sort((a, b) => a.localeCompare(b, "ru"));
}

export function pruneOrgSlice(slice: OrgSliceSelection): OrgSliceSelection {
  const validUnits = new Set(availableUnitsForSlice(slice));
  const units = slice.units.filter((unit) => validUnits.has(unit));
  const validTeams = new Set(availableTeamsForSlice({ departments: slice.departments, units }));
  const teams = slice.teams.filter((team) => validTeams.has(team));
  return { departments: slice.departments, units, teams };
}

export function updateOrgSliceDepartments(slice: OrgSliceSelection, departments: string[]): OrgSliceSelection {
  return pruneOrgSlice({ ...slice, departments });
}

export function updateOrgSliceUnits(slice: OrgSliceSelection, units: string[]): OrgSliceSelection {
  return pruneOrgSlice({ ...slice, units });
}

export function updateOrgSliceTeams(slice: OrgSliceSelection, teams: string[]): OrgSliceSelection {
  return { ...slice, teams };
}

export function primaryDepartmentForOrg(slice: OrgSliceSelection): string {
  return slice.departments[0] ?? departmentOptions()[0] ?? "Engineering";
}

export function primaryUnitForOrg(slice: OrgSliceSelection): string {
  return slice.units[0] ?? "";
}

export function primaryTeamForOrg(slice: OrgSliceSelection): string {
  return slice.teams[0] ?? "";
}
