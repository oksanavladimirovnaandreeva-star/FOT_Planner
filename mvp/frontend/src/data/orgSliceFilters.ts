import { isMultiSelectNone, multiSelectMatches } from "./multiSelectFilter";
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

function effectiveSliceValues(values: string[]): string[] {
  if (isMultiSelectNone(values)) return [];
  return values;
}

export function matchesOrgSlice(
  position: { department: string; unit: string; team: string },
  slice: OrgSliceSelection,
): boolean {
  if (!multiSelectMatches(slice.departments, position.department)) return false;
  if (!multiSelectMatches(slice.units, position.unit)) return false;
  if (!multiSelectMatches(slice.teams, position.team)) return false;
  return true;
}

export function availableUnitsForSlice(slice: Pick<OrgSliceSelection, "departments">): string[] {
  const depts = effectiveSliceValues(slice.departments);
  const deptList = depts.length > 0 ? depts : departmentOptions();
  const units = new Set<string>();
  for (const dept of deptList) {
    for (const unit of unitOptions(dept)) units.add(unit);
  }
  return [...units].sort((a, b) => a.localeCompare(b, "ru"));
}

export function availableTeamsForSlice(slice: Pick<OrgSliceSelection, "departments" | "units">): string[] {
  const depts = effectiveSliceValues(slice.departments);
  const deptList = depts.length > 0 ? depts : departmentOptions();
  const units = effectiveSliceValues(slice.units);
  const teams = new Set<string>();

  if (units.length > 0) {
    for (const dept of deptList) {
      for (const unit of units) {
        if (!unitOptions(dept).includes(unit)) continue;
        for (const team of teamOptions(dept, unit)) teams.add(team);
      }
    }
  } else {
    for (const dept of deptList) {
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
  const departments = effectiveSliceValues(slice.departments);
  return departments[0] ?? departmentOptions()[0] ?? "Engineering";
}

export function primaryUnitForOrg(slice: OrgSliceSelection): string {
  const units = effectiveSliceValues(slice.units);
  return units[0] ?? "";
}

export function primaryTeamForOrg(slice: OrgSliceSelection): string {
  const teams = effectiveSliceValues(slice.teams);
  return teams[0] ?? "";
}
