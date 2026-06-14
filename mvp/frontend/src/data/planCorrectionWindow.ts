import { monthLabel } from "./planningData";
import type { PlanVersionMeta } from "./planVersions";
import type { PlanWorkspaceMode } from "./planWorkspaceMode";

export type CorrectionWindowInfo = {
  /** Квартальное окно: события только с startMonth. */
  enforced: boolean;
  /** null — внутри года нет открытых месяцев (Q4 → январь след. года). */
  startMonth: number | null;
  startMonthLabel: string;
  currentQuarterLabel: string;
};

export function calendarQuarterIndex(month: number): number {
  return Math.floor(Math.max(0, Math.min(11, month)) / 3);
}

export function quarterLabel(quarterIndex: number): string {
  return `Q${quarterIndex + 1}`;
}

/** Первый месяц открытого окна корректировки (0–11) или null в Q4. */
export function correctionWindowStartMonth(refDate = new Date()): number | null {
  const month = refDate.getMonth();
  const quarter = calendarQuarterIndex(month);
  const start = (quarter + 1) * 3;
  if (start > 11) return null;
  return start;
}

export function isAnnualPlanningDraft(activePlan: PlanVersionMeta): boolean {
  return (
    activePlan.kind === "APPROVED" &&
    activePlan.versionNumber === 1 &&
    activePlan.status === "DRAFT"
  );
}

export function isQuarterWorkingDraft(
  activePlan: PlanVersionMeta,
  primaryBudget: PlanVersionMeta | null,
): boolean {
  return activePlan.kind === "WORKING_DRAFT" && primaryBudget != null && primaryBudget.status !== "DRAFT";
}

export function resolveCorrectionWindow(
  _activePlan: PlanVersionMeta,
  _primaryBudget: PlanVersionMeta | null,
  options?: { workspaceMode?: PlanWorkspaceMode; refDate?: Date },
): CorrectionWindowInfo {
  const refDate = options?.refDate ?? new Date();
  const workspaceMode = options?.workspaceMode ?? "planning";
  const currentQuarterLabel = quarterLabel(calendarQuarterIndex(refDate.getMonth()));
  const startMonth = correctionWindowStartMonth(refDate);
  const startMonthLabel = startMonth === null ? "—" : monthLabel(startMonth);

  /** Годовое планирование v1 — все месяцы, только маршрут «Планирование». */
  if (workspaceMode === "planning") {
    return {
      enforced: false,
      startMonth: 0,
      startMonthLabel: monthLabel(0),
      currentQuarterLabel,
    };
  }

  /** Корректировка: квартальное окно всегда enforced (даже без черновика — для подсказок UI). */
  return {
    enforced: true,
    startMonth,
    startMonthLabel,
    currentQuarterLabel,
  };
}

/** Индексы месяцев (0–11), в которые можно добавлять события в текущем окне. */
export function allowedPlanMonthIndexes(window: CorrectionWindowInfo): number[] {
  const indexes: number[] = [];
  for (let month = 0; month < 12; month += 1) {
    if (isPlanEventMonthAllowed(month, window)) indexes.push(month);
  }
  return indexes;
}

export function isPlanEventMonthAllowed(month: number, window: CorrectionWindowInfo): boolean {
  if (!window.enforced) return true;
  if (window.startMonth === null) return false;
  return month >= window.startMonth;
}

/** Месяц до M_open в режиме корректировки — только просмотр в матрице. */
export function isCorrectionMonthLocked(month: number, window: CorrectionWindowInfo): boolean {
  return window.enforced && !isPlanEventMonthAllowed(month, window);
}

export function planEventMonthBlockedMessage(window: CorrectionWindowInfo): string {
  if (!window.enforced) return "";
  if (window.startMonth === null) {
    return `Квартальная корректировка (${window.currentQuarterLabel}): внутри года окно закрыто — правки с января следующего плана.`;
  }
  return `Квартальная корректировка: события только с ${window.startMonthLabel} (после ${window.currentQuarterLabel}).`;
}
