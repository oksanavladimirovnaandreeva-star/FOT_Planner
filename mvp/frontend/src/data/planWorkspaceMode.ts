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
};

export function planTeamPlanningPath(
  team: string,
  mode: PlanWorkspaceMode = "planning",
  options?: PlanTeamPlanningOptions,
): string {
  const params: Record<string, string> = { tab: "positions", team };
  if (options?.leadOnly) params.leadOnly = "1";
  return planWorkspacePath(mode, params);
}

/** Планирование юнита: только позиция юнит-лида (для директора из контура). */
export function planUnitLeadContourPath(unit: string, mode: PlanWorkspaceMode = "planning"): string {
  return planWorkspacePath(mode, { tab: "positions", unit, leadOnly: "unit_lead" });
}
