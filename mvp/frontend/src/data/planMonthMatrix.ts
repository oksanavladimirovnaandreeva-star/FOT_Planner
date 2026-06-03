import { pickFotAmount, type ViewMode } from "./dashboardMetrics";
import {
  hasFactData,
  listFactEmployeesOnPosition,
  monthFactAmountOnPosition,
} from "./factStore";
import { formatOccupancyMonthLabel, isPlanClosedAtMonth, planOccupancyAtMonth } from "./occupancyTimeline";
import type { PositionRecord } from "../types";

export type MatrixDeviation =
  | "none"
  | "no_fact_loaded"
  | "closed"
  | "plan_fact_gap"
  | "fact_over_plan"
  | "multi_on_seat";

export type PlanMonthCell = {
  month: number;
  planStatus: PositionRecord["status"];
  planEmployeeName: string | null;
  planAmount: number;
  factAmount: number;
  factEmployeeCount: number;
  deltaPlanMinusFact: number;
  deviation: MatrixDeviation;
};

export function planAmountAtMonth(position: PositionRecord, month: number, viewMode: ViewMode): number {
  if (month < position.activeFromMonth) return 0;
  if (isPlanClosedAtMonth(position, month)) return 0;
  return pickFotAmount(position.monthlyBase[month] ?? 0, position.monthlyBonus[month] ?? 0, viewMode);
}

export function buildPlanMonthCell(
  position: PositionRecord,
  month: number,
  viewMode: ViewMode,
): PlanMonthCell {
  const snap = planOccupancyAtMonth(position, month);
  const planAmount = planAmountAtMonth(position, month, viewMode);
  const factLoaded = hasFactData();

  if (snap.status === "Closed") {
    return {
      month,
      planStatus: "Closed",
      planEmployeeName: null,
      planAmount: 0,
      factAmount: 0,
      factEmployeeCount: 0,
      deltaPlanMinusFact: 0,
      deviation: "closed",
    };
  }

  if (!factLoaded) {
    return {
      month,
      planStatus: snap.status,
      planEmployeeName: snap.employeeName,
      planAmount,
      factAmount: 0,
      factEmployeeCount: 0,
      deltaPlanMinusFact: 0,
      deviation: "no_fact_loaded",
    };
  }

  const factEmployees = listFactEmployeesOnPosition(position.positionId, month);
  const factAmount = monthFactAmountOnPosition(position, month, viewMode);
  const factEmployeeCount = factEmployees.length;
  const deltaPlanMinusFact = planAmount - factAmount;

  let deviation: MatrixDeviation = "none";
  if (factEmployeeCount >= 2) {
    deviation = "multi_on_seat";
  } else if (planAmount > 0 && factAmount === 0) {
    deviation = "plan_fact_gap";
  } else if (factAmount > planAmount + 1) {
    deviation = "fact_over_plan";
  }

  return {
    month,
    planStatus: snap.status,
    planEmployeeName: snap.employeeName,
    planAmount,
    factAmount,
    factEmployeeCount,
    deltaPlanMinusFact,
    deviation,
  };
}

export const MATRIX_DEVIATION_LABEL: Record<MatrixDeviation, string> = {
  none: "",
  no_fact_loaded: "",
  closed: "Закрыт",
  plan_fact_gap: "Δ план−факт",
  fact_over_plan: "Перерасход",
  multi_on_seat: "2+ в факте",
};

export function matrixMonthOccupancyLabel(
  position: PositionRecord,
  month: number,
  compact = true,
): string {
  return formatOccupancyMonthLabel(planOccupancyAtMonth(position, month), compact);
}
