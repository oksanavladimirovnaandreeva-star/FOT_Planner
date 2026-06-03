import { monthLabel } from "./planningData";
import type { PlanVersionMeta } from "./planVersions";

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

export function resolveCorrectionWindow(
  activePlan: PlanVersionMeta,
  primaryBudget: PlanVersionMeta | null,
  refDate = new Date(),
): CorrectionWindowInfo {
  const currentQuarterLabel = quarterLabel(calendarQuarterIndex(refDate.getMonth()));
  const annualPlanning =
    activePlan.kind === "APPROVED" &&
    activePlan.versionNumber === 1 &&
    activePlan.status === "DRAFT";
  const quarterDraft =
    activePlan.kind === "WORKING_DRAFT" && primaryBudget != null && primaryBudget.status !== "DRAFT";

  if (annualPlanning || !quarterDraft) {
    return {
      enforced: false,
      startMonth: 0,
      startMonthLabel: monthLabel(0),
      currentQuarterLabel,
    };
  }

  const startMonth = correctionWindowStartMonth(refDate);
  return {
    enforced: true,
    startMonth,
    startMonthLabel: startMonth === null ? "—" : monthLabel(startMonth),
    currentQuarterLabel,
  };
}

export function isPlanEventMonthAllowed(month: number, window: CorrectionWindowInfo): boolean {
  if (!window.enforced) return true;
  if (window.startMonth === null) return false;
  return month >= window.startMonth;
}

export function planEventMonthBlockedMessage(window: CorrectionWindowInfo): string {
  if (!window.enforced) return "";
  if (window.startMonth === null) {
    return `Квартальная корректировка (${window.currentQuarterLabel}): внутри года окно закрыто — правки с января следующего плана.`;
  }
  return `Квартальная корректировка: события только с ${window.startMonthLabel} (после ${window.currentQuarterLabel}).`;
}
