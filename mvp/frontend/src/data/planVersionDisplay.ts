import type { PlanVersionKind, PlanVersionMeta, PlanVersionStatus } from "./planVersions";

/** Человекочитаемый статус версии для UI (без сырых enum). */
export function planVersionStatusUiLabel(status: PlanVersionStatus): string {
  switch (status) {
    case "DRAFT":
      return "Не утверждён";
    case "IN_APPROVAL":
      return "На согласовании";
    case "APPROVED":
      return "Утверждён";
    case "ARCHIVED":
      return "Архив";
    default:
      return status;
  }
}

export function planVersionKindUiLabel(kind: PlanVersionKind): string | null {
  if (kind === "WORKING_DRAFT") return "Черновик корректировки";
  return null;
}

/** Подпись в select версии: label + статус. */
export function formatPlanVersionOptionLabel(version: PlanVersionMeta): string {
  const kind = planVersionKindUiLabel(version.kind);
  const status = planVersionStatusUiLabel(version.status);
  if (kind && version.status === "DRAFT") {
    return `${version.label} · ${kind}`;
  }
  if (version.status === "APPROVED" && version.kind === "APPROVED") {
    return version.label;
  }
  return `${version.label} · ${status}`;
}
