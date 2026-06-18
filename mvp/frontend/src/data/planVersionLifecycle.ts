import type { PlanVersionMeta } from "./planVersions";
import { isBudgetLocked, primaryBudgetVersion } from "./planVersions";

/** C&B: кнопка «Создать квартальный черновик» — не зависит от canEditPlan (на утверждённой v1 правок нет). */
export function canCreateQuarterlyWorkingDraft(input: {
  canManagePlanVersions: boolean;
  latestApproved: PlanVersionMeta | null;
  primaryBudget: PlanVersionMeta | null;
  workingDraft: PlanVersionMeta | null;
}): boolean {
  const { canManagePlanVersions, latestApproved, primaryBudget, workingDraft } = input;
  if (!canManagePlanVersions) return false;
  if (!latestApproved || !primaryBudget) return false;
  if (!isBudgetLocked(primaryBudget)) return false;
  if (workingDraft) return false;
  return true;
}

export function hasPublishedCorrections(versions: PlanVersionMeta[]): boolean {
  return versions.some(
    (version) =>
      version.kind === "APPROVED" && version.versionNumber > 1 && version.status === "APPROVED",
  );
}

export function findWorkingDraft(versions: PlanVersionMeta[]): PlanVersionMeta | undefined {
  return versions.find((version) => version.kind === "WORKING_DRAFT");
}

/** C&B: можно вернуть v1 из APPROVED в DRAFT для прямых правок. */
export function canReopenPrimaryBudget(versions: PlanVersionMeta[]): { ok: true } | { ok: false; error: string } {
  const primary = primaryBudgetVersion(versions);
  if (!primary) {
    return { ok: false, error: "Первая версия бюджета не найдена." };
  }
  if (!isBudgetLocked(primary)) {
    return { ok: false, error: "Бюджет ещё не утверждён — правки доступны без отката." };
  }
  if (hasPublishedCorrections(versions)) {
    return {
      ok: false,
      error: "Есть утверждённые квартальные версии (v2+). Откат годового бюджета недоступен.",
    };
  }
  if (findWorkingDraft(versions)) {
    return {
      ok: false,
      error: "Сначала удалите квартальный черновик на вкладке «Версии бюджета».",
    };
  }
  return { ok: true };
}

export function reopenPrimaryBudgetMeta(version: PlanVersionMeta): PlanVersionMeta {
  return {
    ...version,
    status: "DRAFT",
    publishedAt: undefined,
  };
}
