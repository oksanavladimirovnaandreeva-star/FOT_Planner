import type { OrgSliceSelection } from "./orgSliceFilters";
import { resolveActivePersonaOrgScope } from "./demoSessionStore";
import type { OrgFilterDefaults } from "./userAccess";

export type PlanningDeepLinkParams = {
  team: string | null;
  unit: string | null;
  department: string | null;
};

export function readPlanningDeepLinkParams(searchParams: URLSearchParams): PlanningDeepLinkParams {
  return {
    team: searchParams.get("team") ?? searchParams.get("sliceTeam"),
    unit: searchParams.get("unit") ?? searchParams.get("sliceUnit"),
    department: searchParams.get("department"),
  };
}

export function hasPlanningDeepLinkParams(params: PlanningDeepLinkParams): boolean {
  return Boolean(params.team || params.unit || params.department);
}

/** Применяет team/unit/department из URL к org-срезу (после перехода из «Мой бюджет»). */
export function applyPlanningDeepLinkSlice(
  prev: OrgSliceSelection,
  params: PlanningDeepLinkParams,
  orgFilterDefaults: OrgFilterDefaults | null,
): OrgSliceSelection {
  if (!hasPlanningDeepLinkParams(params)) return prev;

  if (orgFilterDefaults) {
    return {
      departments: params.department ? [params.department] : orgFilterDefaults.departments,
      units: params.unit ? [params.unit] : orgFilterDefaults.units,
      teams: params.team ? [params.team] : params.unit ? [] : orgFilterDefaults.teams,
    };
  }

  const personaDept = resolveActivePersonaOrgScope()?.department;
  return {
    departments: params.department ? [params.department] : personaDept ? [personaDept] : prev.departments,
    units: params.unit ? [params.unit] : prev.units,
    teams: params.team ? [params.team] : params.unit ? [] : [],
  };
}

export function stripPlanningDeepLinkParams(prev: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(prev);
  next.delete("team");
  next.delete("sliceTeam");
  next.delete("unit");
  next.delete("sliceUnit");
  next.delete("department");
  return next;
}
