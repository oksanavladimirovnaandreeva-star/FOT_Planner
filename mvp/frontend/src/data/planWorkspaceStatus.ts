import type { PlanVersionMeta } from "./planVersions";

export type PlanWorkspaceStatusTone = "ok" | "warn" | "muted";

export type PlanWorkspaceStatus = {
  label: string;
  tone: PlanWorkspaceStatusTone;
};

/** Человекочитаемый статус версии для сайдбара (без DRAFT / WORKING_DRAFT). */
export function resolvePlanWorkspaceStatus(params: {
  activePlan: PlanVersionMeta;
  canEditPlan: boolean;
  leadEditFrozenForRole: boolean;
}): PlanWorkspaceStatus {
  const { activePlan, canEditPlan, leadEditFrozenForRole } = params;

  if (activePlan.status === "ARCHIVED") {
    return { label: "Архив", tone: "muted" };
  }
  if (leadEditFrozenForRole) {
    return { label: "Правки закрыты", tone: "warn" };
  }
  if (activePlan.status === "IN_APPROVAL") {
    return { label: "На согласовании", tone: "warn" };
  }
  if (canEditPlan) {
    return { label: "Можно править", tone: "ok" };
  }
  return { label: "Только просмотр", tone: "muted" };
}
