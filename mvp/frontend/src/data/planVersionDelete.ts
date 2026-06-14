import type { PositionRecord } from "../types";
import {
  findWorkingDraftForBaseline,
  latestApprovedVersion,
  type PlanVersionMeta,
} from "./planVersions";

export type PlanVersionDeleteResult =
  | {
      ok: true;
      versions: PlanVersionMeta[];
      dataByVersion: Record<string, PositionRecord[]>;
      fallbackVersionId: string;
      deletedLabel: string;
    }
  | { ok: false; error: string };

/** Может ли C&B удалить версию (проверка без мутации). */
export function canDeletePlanVersion(versionId: string, versions: PlanVersionMeta[]): { ok: true } | { ok: false; error: string } {
  if (versions.length <= 1) {
    return { ok: false, error: "Нельзя удалить единственную версию плана." };
  }

  const target = versions.find((version) => version.id === versionId);
  if (!target) {
    return { ok: false, error: "Версия не найдена." };
  }

  const draftForBaseline = findWorkingDraftForBaseline(versions, versionId);
  if (draftForBaseline) {
    return {
      ok: false,
      error: `Сначала удалите черновик «${draftForBaseline.label}», привязанный к этой версии.`,
    };
  }

  const activeApproved = versions.filter(
    (version) => version.kind === "APPROVED" && version.status !== "ARCHIVED",
  );

  if (target.kind === "APPROVED" && target.status !== "ARCHIVED" && activeApproved.length <= 1) {
    return {
      ok: false,
      error: "Нельзя удалить единственную активную утверждённую версию.",
    };
  }

  if (target.kind === "APPROVED" && target.versionNumber === 1 && target.status === "DRAFT") {
    const hasOtherWorkable = versions.some(
      (version) =>
        version.id !== versionId &&
        (version.kind === "WORKING_DRAFT" ||
          (version.kind === "APPROVED" && version.status === "APPROVED")),
    );
    if (!hasOtherWorkable) {
      return {
        ok: false,
        error: "Нельзя удалить неутверждённый v1 — нет другой версии для работы.",
      };
    }
  }

  return { ok: true };
}

export function deletePlanVersionState(
  versionId: string,
  versions: PlanVersionMeta[],
  dataByVersion: Record<string, PositionRecord[]>,
  currentVersionId: string,
): PlanVersionDeleteResult {
  const policy = canDeletePlanVersion(versionId, versions);
  if (!policy.ok) return policy;

  const target = versions.find((version) => version.id === versionId)!;
  const nextVersions = versions.filter((version) => version.id !== versionId);
  const nextData = { ...dataByVersion };
  delete nextData[versionId];

  let fallbackVersionId = currentVersionId;
  if (currentVersionId === versionId) {
    const latest = latestApprovedVersion(nextVersions);
    fallbackVersionId = latest?.id ?? nextVersions[0]?.id ?? currentVersionId;
  }

  return {
    ok: true,
    versions: nextVersions,
    dataByVersion: nextData,
    fallbackVersionId,
    deletedLabel: target.label,
  };
}
