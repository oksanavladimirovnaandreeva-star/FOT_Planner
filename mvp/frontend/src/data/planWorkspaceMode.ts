/** Маршрут рабочего пространства: годовое планирование vs квартальная версия. */
export type PlanWorkspaceMode = "planning" | "correction";

export const PLAN_WORKSPACE_LABELS: Record<PlanWorkspaceMode, string> = {
  planning: "Планирование",
  correction: "Квартальное планирование",
};

export function planWorkspaceBasePath(mode: PlanWorkspaceMode): string {
  return mode === "correction" ? "/planning?mode=correction" : "/planning";
}

export function planWorkspacePath(mode: PlanWorkspaceMode, params?: Record<string, string>): string {
  const search = new URLSearchParams();
  if (mode === "correction") search.set("mode", "correction");
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      search.set(key, value);
    }
  }
  const query = search.toString();
  return query ? `/planning?${query}` : "/planning";
}

export type PlanTeamPlanningOptions = {
  /** Из «Ваш контур» — только позиция тимлида команды. */
  leadOnly?: boolean;
  unit?: string;
  department?: string;
};

export function planTeamPlanningPath(
  team: string,
  mode: PlanWorkspaceMode = "planning",
  options?: PlanTeamPlanningOptions,
): string {
  const params: Record<string, string> = { tab: "positions", team };
  if (options?.unit) params.unit = options.unit;
  if (options?.department) params.department = options.department;
  if (options?.leadOnly) params.leadOnly = "1";
  return planWorkspacePath(mode, params);
}

/** Планирование юнита: только позиция юнит-лида (для директора из контура). */
export function planUnitLeadContourPath(
  unit: string,
  mode: PlanWorkspaceMode = "planning",
  department?: string,
): string {
  const params: Record<string, string> = { tab: "positions", unit, leadOnly: "unit_lead" };
  if (department) params.department = department;
  return planWorkspacePath(mode, params);
}

/** Планирование всего юнита (без leadOnly). */
export function planUnitPlanningPath(
  unit: string,
  mode: PlanWorkspaceMode = "planning",
  department?: string,
): string {
  const params: Record<string, string> = { tab: "positions", unit };
  if (department) params.department = department;
  return planWorkspacePath(mode, params);
}
