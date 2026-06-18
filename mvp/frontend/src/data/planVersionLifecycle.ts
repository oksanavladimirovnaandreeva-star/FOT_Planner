import type { PlanVersionMeta } from "./planVersions";
import { isBudgetLocked, primaryBudgetVersion } from "./planVersions";

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
      error: "Есть утверждённые корректировки (v2+). Откат годового бюджета недоступен.",
    };
  }
  if (findWorkingDraft(versions)) {
    return {
      ok: false,
      error: "Сначала удалите черновик корректировки на вкладке «Версии бюджета».",
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
