/** Маршрут рабочего пространства: годовое планирование vs квартальная корректировка. */
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
