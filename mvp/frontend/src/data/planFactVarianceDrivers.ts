import { monthAmountForPosition, monthFactAmount, type ViewMode } from "./dashboardMetrics";
import { hasFactData, listFactEmployeesOnPosition } from "./factStore";
import { monthLabel } from "./planningData";
import { planFactDelta } from "./planFactMetrics";
import { planOccupancyTimelineFast } from "./occupancyTimeline";
import type { PositionRecord } from "../types";

export type PlanFactVarianceDriverId =
  | "VACANCY_UNFILLED"
  | "HIRED_CHEAPER"
  | "HIRED_MORE_EXPENSIVE"
  | "UNPLANNED_HIRE"
  | "NO_FACT_PAYMENT"
  | "MULTI_ON_SEAT"
  | "OTHER";

export const PLAN_FACT_VARIANCE_DRIVER_LABELS: Record<PlanFactVarianceDriverId, string> = {
  VACANCY_UNFILLED: "Вакансия не закрыта",
  HIRED_CHEAPER: "Ниже плана (дешевле)",
  HIRED_MORE_EXPENSIVE: "Выше плана (дороже)",
  UNPLANNED_HIRE: "Найм на вакансии (факт без плана)",
  NO_FACT_PAYMENT: "В плане занято, в факте нет выплат",
  MULTI_ON_SEAT: "Двое и более на позиции",
  OTHER: "Прочее",
};

export const PLAN_FACT_VARIANCE_DRIVER_HINTS: Record<PlanFactVarianceDriverId, string> = {
  VACANCY_UNFILLED: "По плану вакансия с бюджетом, в факте выплат нет — обычно экономия.",
  HIRED_CHEAPER: "Позиция занята, фактический ФОТ ниже планового оклада/ФОТ.",
  HIRED_MORE_EXPENSIVE: "Позиция занята, фактический ФОТ выше плана — переплата.",
  UNPLANNED_HIRE: "В плане вакансия, в факте уже есть выплаты — раньше или вне плана.",
  NO_FACT_PAYMENT: "В плане сотрудник, в факте за месяц нет выплат (отсутствие, задержка импорта).",
  MULTI_ON_SEAT: "На одной позиции в факте несколько сотрудников в месяце.",
  OTHER: "Прочие расхождения сумм без явного сценария.",
};

export type PlanFactVarianceDriverCase = {
  driverId: PlanFactVarianceDriverId;
  positionId: string;
  role: string;
  department: string;
  unit: string;
  team: string;
  month: number;
  monthLabel: string;
  planAmount: number;
  factAmount: number;
  /** Всегда план − факт. Плюс — экономия, минус — перерасход. */
  delta: number;
};

export type PlanFactVarianceDriverSummary = {
  id: PlanFactVarianceDriverId;
  label: string;
  hint: string;
  economy: number;
  overspend: number;
  netDelta: number;
  caseCount: number;
};

function ytdMonthIndex(): number {
  return new Date().getMonth();
}

function isPlanVacantAtMonth(snapshot: ReturnType<typeof planOccupancyTimelineFast>[number]): boolean {
  return snapshot.status === "Vacancy" || snapshot.status === "Closed" || !snapshot.employeeId;
}

export function classifyMonthVarianceDriver(params: {
  planVacant: boolean;
  planAmount: number;
  factAmount: number;
  factEmployeeCount: number;
}): PlanFactVarianceDriverId {
  const { planVacant, planAmount, factAmount, factEmployeeCount } = params;
  const delta = planFactDelta(planAmount, factAmount);
  if (delta === 0) return "OTHER";

  if (factEmployeeCount >= 2) return "MULTI_ON_SEAT";
  if (planVacant && factAmount === 0 && planAmount > 0) return "VACANCY_UNFILLED";
  if (planVacant && factAmount > 0) return "UNPLANNED_HIRE";
  if (!planVacant && factAmount === 0 && planAmount > 0) return "NO_FACT_PAYMENT";
  if (!planVacant && factAmount > 0 && delta > 0) return "HIRED_CHEAPER";
  if (!planVacant && factAmount > 0 && delta < 0) return "HIRED_MORE_EXPENSIVE";
  return "OTHER";
}

export function collectPlanFactVarianceDrivers(
  positions: PositionRecord[],
  viewMode: ViewMode,
): PlanFactVarianceDriverCase[] {
  if (!hasFactData()) return [];
  const ytd = ytdMonthIndex();
  const cases: PlanFactVarianceDriverCase[] = [];

  for (const position of positions) {
    if (position.status === "Closed") continue;
    const occupancyTimeline = planOccupancyTimelineFast(position);
    for (let month = position.activeFromMonth; month <= ytd; month += 1) {
      const planAmount = monthAmountForPosition(position, month, viewMode);
      const factAmount = monthFactAmount(position, month, viewMode);
      const delta = planFactDelta(planAmount, factAmount);
      if (delta === 0) continue;

      const planSnap = occupancyTimeline[month];
      if (planSnap.status === "Closed") continue;

      const factEmployeeCount = listFactEmployeesOnPosition(position.positionId, month).length;
      const driverId = classifyMonthVarianceDriver({
        planVacant: isPlanVacantAtMonth(planSnap),
        planAmount,
        factAmount,
        factEmployeeCount,
      });

      cases.push({
        driverId,
        positionId: position.positionId,
        role: position.role,
        department: position.department,
        unit: position.unit,
        team: position.team,
        month,
        monthLabel: monthLabel(month),
        planAmount,
        factAmount,
        delta,
      });
    }
  }

  return cases.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

export function summarizeVarianceDrivers(cases: PlanFactVarianceDriverCase[]): PlanFactVarianceDriverSummary[] {
  const acc = new Map<PlanFactVarianceDriverId, PlanFactVarianceDriverSummary>();

  for (const item of cases) {
    const current = acc.get(item.driverId) ?? {
      id: item.driverId,
      label: PLAN_FACT_VARIANCE_DRIVER_LABELS[item.driverId],
      hint: PLAN_FACT_VARIANCE_DRIVER_HINTS[item.driverId],
      economy: 0,
      overspend: 0,
      netDelta: 0,
      caseCount: 0,
    };
    if (item.delta > 0) current.economy += item.delta;
    if (item.delta < 0) current.overspend += Math.abs(item.delta);
    current.netDelta += item.delta;
    current.caseCount += 1;
    acc.set(item.driverId, current);
  }

  return [...acc.values()].sort((a, b) => Math.abs(b.netDelta) - Math.abs(a.netDelta));
}
