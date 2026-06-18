import type { PositionRecord } from "../types";

export type PlanVersionKind = "APPROVED" | "WORKING_DRAFT";

export type PlanVersionStatus = "APPROVED" | "ARCHIVED" | "DRAFT" | "IN_APPROVAL";

export interface PlanVersionMeta {
  id: string;
  label: string;
  planYear: number;
  versionNumber: number;
  kind: PlanVersionKind;
  status: PlanVersionStatus;
  /** Предыдущая утверждённая версия (для v2+). */
  parentVersionId: string | null;
  /** Для черновика: с какой утверждённой версией сравниваем. */
  baselineVersionId: string | null;
  createdAt: string;
  publishedAt?: string;
}

export const PLAN_VERSION_KIND_LABELS: Record<PlanVersionKind, string> = {
  APPROVED: "Утверждённый бюджет",
  WORKING_DRAFT: "Рабочий черновик",
};

export const PLAN_VERSION_STATUS_LABELS: Record<PlanVersionStatus, string> = {
  APPROVED: "Утверждён",
  ARCHIVED: "Архив",
  DRAFT: "Черновик",
  IN_APPROVAL: "На согласовании",
};

const VERSIONS_STORAGE_KEY = "fot_mvp_plan_versions_meta";
const DATA_STORAGE_KEY = "fot_mvp_plan_data_by_version";

export function clonePositionRecord(position: PositionRecord): PositionRecord {
  return {
    ...position,
    events: position.events.map((event) => ({
      ...event,
      payload: { ...event.payload },
    })),
    monthlyBase: [...position.monthlyBase],
    monthlyBonus: [...position.monthlyBonus],
    monthlySpec: [...position.monthlySpec],
    monthlyLevel: [...position.monthlyLevel],
    seedMonthlyBase: [...position.seedMonthlyBase],
    seedMonthlyBonus: [...position.seedMonthlyBonus],
    seedMonthlySpec: [...position.seedMonthlySpec],
    seedMonthlyLevel: [...position.seedMonthlyLevel],
  };
}

export function clonePositionList(positions: PositionRecord[]): PositionRecord[] {
  return positions.map(clonePositionRecord);
}

function versionId(planYear: number, versionNumber: number): string {
  return `budget-${planYear}-v${versionNumber}`;
}

function draftId(planYear: number, baselineVersionId: string): string {
  const suffix = baselineVersionId.replace(/[^a-z0-9]+/gi, "-");
  return `draft-${planYear}-${suffix}`;
}

export function annualBudgetLabel(planYear: number): string {
  return `Бюджет ${planYear}`;
}

export function quarterCorrectionLabel(planYear: number, quarterIndex: number): string {
  const quarter = Math.max(1, Math.min(4, quarterIndex));
  return `${quarter} Квартал ${planYear}`;
}

/** v1 = годовой бюджет; v2+ = утверждённая корректировка квартала. */
export function defaultVersionLabel(planYear: number, versionNumber: number): string {
  if (versionNumber === 1) {
    return annualBudgetLabel(planYear);
  }
  return quarterCorrectionLabel(planYear, versionNumber - 1);
}

function draftLabelFor(baseline: { planYear: number; versionNumber: number }): string {
  return quarterCorrectionLabel(baseline.planYear, baseline.versionNumber);
}

function versionStepLabel(version: { planYear: number; versionNumber: number }, suffix: string): string {
  return `${defaultVersionLabel(version.planYear, version.versionNumber)} · ${suffix}`;
}

export function initialPlanVersions(planYear = 2026): PlanVersionMeta[] {
  const id = versionId(planYear, 1);
  return [
    {
      id,
      label: defaultVersionLabel(planYear, 1),
      planYear,
      versionNumber: 1,
      kind: "APPROVED",
      /** До явного утверждения v1 можно править напрямую. */
      status: "DRAFT",
      parentVersionId: null,
      baselineVersionId: null,
      createdAt: new Date(2026, 0, 1).toISOString(),
    },
  ];
}

export function isBudgetLocked(version: PlanVersionMeta): boolean {
  if (version.kind === "WORKING_DRAFT") return false;
  return version.status === "APPROVED" || version.status === "ARCHIVED";
}

export function canEditVersion(version: PlanVersionMeta | undefined): boolean {
  if (!version) return false;
  if (version.kind === "WORKING_DRAFT") return true;
  if (version.kind === "APPROVED" && version.status === "DRAFT") return true;
  if (version.status === "IN_APPROVAL") return false;
  return false;
}

export function repairVersionLabels(versions: PlanVersionMeta[]): PlanVersionMeta[] {
  const byId = new Map(versions.map((version) => [version.id, version]));
  return versions.map((version) => {
    if (version.kind === "WORKING_DRAFT") {
      const baseline = version.baselineVersionId ? byId.get(version.baselineVersionId) : null;
      const baselineMeta = baseline ?? { planYear: version.planYear, versionNumber: version.versionNumber };
      return { ...version, label: draftLabelFor(baselineMeta) };
    }
    if (version.kind === "APPROVED") {
      return { ...version, label: defaultVersionLabel(version.planYear, version.versionNumber) };
    }
    return version;
  });
}

export function repairDataByVersion(
  versions: PlanVersionMeta[],
  data: Record<string, PositionRecord[]>,
): Record<string, PositionRecord[]> {
  let changed = false;
  const next: Record<string, PositionRecord[]> = { ...data };
  for (const version of versions) {
    if (version.kind !== "WORKING_DRAFT" || !version.baselineVersionId) continue;
    const baselineRows = next[version.baselineVersionId];
    if (!baselineRows?.length) continue;
    if (!next[version.id]?.length) {
      next[version.id] = clonePositionList(baselineRows);
      changed = true;
    }
  }
  return changed ? next : data;
}

export type ApprovalStepState = "done" | "current" | "pending";

export interface ApprovalStep {
  id: string;
  label: string;
  hint: string;
  state: ApprovalStepState;
}

export function buildApprovalRoute(
  versions: PlanVersionMeta[],
  workingDraft: PlanVersionMeta | null,
): ApprovalStep[] {
  const primary = versions.find((version) => version.versionNumber === 1 && version.kind === "APPROVED");
  const latest = [...versions]
    .filter((version) => version.kind === "APPROVED")
    .sort((a, b) => b.versionNumber - a.versionNumber)[0];
  const primaryLocked = primary ? isBudgetLocked(primary) : false;
  const nextVersionNumber = (latest?.versionNumber ?? 1) + 1;
  const nextPublishMeta = {
    planYear: latest?.planYear ?? primary?.planYear ?? 2026,
    versionNumber: nextVersionNumber,
  };

  const steps: ApprovalStep[] = [
    {
      id: "edit-v1",
      label: primary
        ? versionStepLabel(primary, "правки")
        : versionStepLabel({ planYear: 2026, versionNumber: 1 }, "правки"),
      hint: "Пока не утверждён — редактируется на планировании",
      state: primary && !primaryLocked ? "current" : "done",
    },
    {
      id: "approve-v1",
      label: primary
        ? versionStepLabel(primary, "утверждение")
        : versionStepLabel({ planYear: 2026, versionNumber: 1 }, "утверждение"),
      hint: "Фиксирует первую версию, дальше — только черновик",
      state: primary && !primaryLocked ? "current" : primaryLocked ? "done" : "pending",
    },
    {
      id: "quarter-draft",
      label: workingDraft
        ? workingDraft.label
        : quarterCorrectionLabel(nextPublishMeta.planYear, latest?.versionNumber ?? 1),
      hint: "Правки и сдача команд в квартальном планировании",
      state: workingDraft ? (workingDraft.status === "IN_APPROVAL" ? "done" : "current") : primaryLocked ? "pending" : "pending",
    },
    {
      id: "approval-route",
      label: "Согласование",
      hint: "Проверка правил по событиям черновика (вкладка «Мой бюджет»)",
      state: workingDraft?.status === "IN_APPROVAL" ? "current" : workingDraft?.status === "DRAFT" ? "pending" : "pending",
    },
    {
      id: "publish",
      label: `Публикация · ${defaultVersionLabel(nextPublishMeta.planYear, nextPublishMeta.versionNumber)}`,
      hint: "Новая версия бюджета, без перезаписи истории",
      state: "pending",
    },
  ];

  if (workingDraft?.status === "IN_APPROVAL") {
    steps.find((step) => step.id === "approval-route")!.state = "current";
    steps.find((step) => step.id === "quarter-draft")!.state = "done";
  }

  return steps;
}

export function loadPersistedVersions(): PlanVersionMeta[] | null {
  try {
    const raw = localStorage.getItem(VERSIONS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return repairVersionLabels(parsed as PlanVersionMeta[]);
  } catch {
    return null;
  }
}

export function persistVersions(versions: PlanVersionMeta[]): void {
  localStorage.setItem(VERSIONS_STORAGE_KEY, JSON.stringify(versions));
}

export function loadPersistedDataByVersion(): Record<string, PositionRecord[]> | null {
  try {
    const raw = localStorage.getItem(DATA_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Record<string, PositionRecord[]>;
  } catch {
    return null;
  }
}

export function persistDataByVersion(data: Record<string, PositionRecord[]>): void {
  localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify(data));
}

export function findWorkingDraftForBaseline(
  versions: PlanVersionMeta[],
  baselineVersionId: string,
): PlanVersionMeta | undefined {
  return versions.find(
    (version) => version.kind === "WORKING_DRAFT" && version.baselineVersionId === baselineVersionId,
  );
}

export function latestApprovedVersion(versions: PlanVersionMeta[]): PlanVersionMeta | undefined {
  return [...versions]
    .filter((version) => version.kind === "APPROVED" && version.status !== "ARCHIVED")
    .sort((a, b) => b.versionNumber - a.versionNumber)[0];
}

export function primaryBudgetVersion(versions: PlanVersionMeta[]): PlanVersionMeta | undefined {
  return versions.find((version) => version.kind === "APPROVED" && version.versionNumber === 1);
}

/** При публикации черновика: дек прошлого года = дек плана родительской версии. */
export function positionsForPublishedVersion(
  draftPositions: PositionRecord[],
  parentPositions: PositionRecord[],
): PositionRecord[] {
  const parentDecById = new Map(
    parentPositions.map((position) => [position.positionId, position.monthlyBase[11] ?? 0] as const),
  );
  return clonePositionList(draftPositions).map((position) => {
    const parentDec = parentDecById.get(position.positionId);
    if (parentDec === undefined) return position;
    return { ...position, previousDecemberBase: parentDec };
  });
}

export function buildWorkingDraftMeta(source: PlanVersionMeta): PlanVersionMeta {
  const now = new Date().toISOString();
  return {
    id: draftId(source.planYear, source.id),
    label: draftLabelFor(source),
    planYear: source.planYear,
    versionNumber: source.versionNumber,
    kind: "WORKING_DRAFT",
    status: "DRAFT",
    parentVersionId: source.id,
    baselineVersionId: source.id,
    createdAt: now,
  };
}

export function buildPublishedVersionMeta(
  draft: PlanVersionMeta,
  parent: PlanVersionMeta,
): PlanVersionMeta {
  const nextNumber = parent.versionNumber + 1;
  const now = new Date().toISOString();
  return {
    id: versionId(draft.planYear, nextNumber),
    label: defaultVersionLabel(draft.planYear, nextNumber),
    planYear: draft.planYear,
    versionNumber: nextNumber,
    kind: "APPROVED",
    status: "APPROVED",
    parentVersionId: parent.id,
    baselineVersionId: null,
    createdAt: now,
    publishedAt: now,
  };
}

export function archiveApprovedVersion(version: PlanVersionMeta): PlanVersionMeta {
  return { ...version, status: "ARCHIVED" };
}

const LEGACY_VERSION_IDS = new Set(["baseline-2026", "corr-2026"]);

/** Старый MVP: два mock-id без lineage — сбрасываем к v1. */
export function migrateLegacyStorage(
  versions: PlanVersionMeta[] | null,
  data: Record<string, PositionRecord[]> | null,
): { versions: PlanVersionMeta[]; dataByVersion: Record<string, PositionRecord[]> } | null {
  if (!versions?.length) return null;
  const hasLegacy = versions.some((version) => LEGACY_VERSION_IDS.has(version.id));
  if (!hasLegacy) return null;
  const freshVersions = initialPlanVersions(2026);
  const approvedId = freshVersions[0].id;
  const legacyData = data?.["baseline-2026"] ?? data?.["corr-2026"] ?? null;
  return {
    versions: freshVersions,
    dataByVersion: { [approvedId]: legacyData ? clonePositionList(legacyData) : [] },
  };
}
