import { defaultVersionLabel, type PlanVersionKind, type PlanVersionMeta, type PlanVersionStatus } from "./planVersions";
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

export function planVersionKindUiLabel(kind: PlanVersionKind, status?: PlanVersionStatus): string | null {
  if (kind === "WORKING_DRAFT" && status === "DRAFT") return "черновик";
  return null;
}

/** Единая подпись: «Бюджет 2026» или «1 Квартал 2026». */
export function formatPlanVersionTitle(
  version: Pick<PlanVersionMeta, "planYear" | "versionNumber"> & Partial<Pick<PlanVersionMeta, "label">>,
): string {
  return version.label ?? defaultVersionLabel(version.planYear, version.versionNumber);
}

/** Бейдж цикла в шапке маршрута (то же содержание, компактный формат). */
export function formatCorrectionCycleBadge(version: Pick<PlanVersionMeta, "planYear" | "versionNumber" | "kind">): string {
  if (version.versionNumber === 1 && version.kind !== "WORKING_DRAFT") {
    return `Годовой план ${version.planYear}`;
  }
  const q = Math.max(1, Math.min(4, version.versionNumber));
  return `Квартальная версия Q${q}`;
}

export function formatPlanVersionStepLabel(
  version: Pick<PlanVersionMeta, "planYear" | "versionNumber">,
  suffix: string,
): string {
  return `${formatPlanVersionTitle(version)} · ${suffix}`;
}

export function formatDraftOfVersionTitle(
  baseline: Pick<PlanVersionMeta, "planYear" | "versionNumber" | "label">,
): string {
  return formatPlanVersionTitle(baseline);
}

export function formatApprovePrimaryBudgetConfirm(
  primary: Pick<PlanVersionMeta, "planYear" | "versionNumber">,
): string {
  return `Утвердить ${formatPlanVersionTitle(primary)}? После этого правки только через квартальный черновик.`;
}

export function formatReopenPrimaryBudgetConfirm(
  primary: Pick<PlanVersionMeta, "planYear" | "versionNumber">,
): string {
  return (
    `Открыть ${formatPlanVersionTitle(primary)} для правок?\n\n` +
    "Утверждение будет снято. Команды смогут править годовой бюджет напрямую до повторного утверждения."
  );
}

/** Подпись в select версии: label + статус. */
export function formatPlanVersionOptionLabel(version: PlanVersionMeta): string {
  const title = formatPlanVersionTitle(version);
  const kind = planVersionKindUiLabel(version.kind, version.status);
  const status = planVersionStatusUiLabel(version.status);
  if (kind) {
    return `${title} · ${kind}`;
  }
  if (version.status === "APPROVED" && version.kind === "APPROVED") {
    return title;
  }
  if (version.versionNumber === 1 && version.kind === "APPROVED" && version.status === "DRAFT") {
    return `${title} · ${status}`;
  }
  return `${title} · ${status}`;
}
