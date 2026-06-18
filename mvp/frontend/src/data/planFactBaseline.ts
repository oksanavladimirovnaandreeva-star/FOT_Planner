import {
  latestApprovedVersion,
  PLAN_VERSION_STATUS_LABELS,
  type PlanVersionMeta,
} from "./planVersions";
import { mapPositionsWithAppliedEvents } from "./planOperations";
import type { PositionRecord } from "../types";

export type PlanFactBaseline = {
  planVersion: PlanVersionMeta;
  positions: PositionRecord[];
  /** Позиции с применёнными событиями — для аналитики план–факт. */
  appliedPositions: PositionRecord[];
  /** В сайдбаре выбрана другая версия, чем база для план–факт. */
  differsFromSidebar: boolean;
  sidebarVersion: PlanVersionMeta;
};

/**
 * База плана для сравнения с фактом: последняя утверждённая (не архив) версия.
 * Черновик в сайдбаре на план–факт не подменяет операционный план.
 */
export function resolvePlanFactBaseline(
  versions: PlanVersionMeta[],
  dataByVersion: Record<string, PositionRecord[]>,
  sidebarVersionId: string,
): PlanFactBaseline {
  const sidebar = versions.find((version) => version.id === sidebarVersionId) ?? versions[0];
  const approved = latestApprovedVersion(versions);
  const planVersion =
    approved && approved.kind === "APPROVED" && approved.status !== "ARCHIVED" ? approved : sidebar;

  const positions = dataByVersion[planVersion.id] ?? [];

  return {
    planVersion,
    positions,
    appliedPositions: mapPositionsWithAppliedEvents(positions),
    differsFromSidebar: planVersion.id !== sidebar.id,
    sidebarVersion: sidebar,
  };
}

export function formatPlanFactComparisonLine(baseline: PlanFactBaseline): string {
  const status = PLAN_VERSION_STATUS_LABELS[baseline.planVersion.status];
  const published =
    baseline.planVersion.publishedAt &&
    new Date(baseline.planVersion.publishedAt).toLocaleDateString("ru-RU");
  const datePart = published ? ` · утверждён ${published}` : "";
  return `Сравнение: план «${baseline.planVersion.label}» (${status})${datePart} ↔ факт (загрузка по месяцам)`;
}
