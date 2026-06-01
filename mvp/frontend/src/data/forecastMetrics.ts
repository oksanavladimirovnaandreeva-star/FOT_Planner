import { monthAmountForPosition } from "./dashboardMetrics";
import { hasFactData, monthFactAmountForPosition } from "./factStore";
import { mapPositionsWithAppliedEvents } from "./planOperations";
import { decGrowthByLimitFlag, formatGrowthPct } from "./planningData";
import type { ViewMode } from "./dashboardMetrics";
import type { PositionRecord } from "../types";
import { MONTHS } from "../types";

function monthForecastAmount(
  position: PositionRecord,
  month: number,
  viewMode: ViewMode,
  useFact: boolean,
): number {
  if (useFact) {
    const fact = monthFactAmountForPosition(position, month, viewMode);
    if (fact > 0) return fact;
  }
  return monthAmountForPosition(position, month, viewMode);
}

/** Упрощённый прогноз: факт YTD + план на оставшиеся месяцы (без пересчёта событий плана). */
export function naiveForecastTotals(positions: PositionRecord[], viewMode: ViewMode, throughMonth: number) {
  const month = Math.max(0, Math.min(11, throughMonth));
  let actualYtd = 0;
  let planYtd = 0;
  let forecastRemainderPlan = 0;
  for (const position of positions) {
    if (position.status === "Closed") continue;
    for (let m = 0; m <= month; m += 1) {
      actualYtd += monthFactAmountForPosition(position, m, viewMode);
      planYtd += monthAmountForPosition(position, m, viewMode);
    }
    for (let m = month + 1; m < 12; m += 1) {
      forecastRemainderPlan += monthAmountForPosition(position, m, viewMode);
    }
  }
  const forecastYear = actualYtd + forecastRemainderPlan;
  const planYear = planYtd + forecastRemainderPlan;
  return {
    throughMonth: month,
    throughLabel: MONTHS[month],
    actualYtd,
    planYtd,
    forecastRemainderPlan,
    forecastYear,
    planYear,
    varianceYtd: actualYtd - planYtd,
    usesPlanEvents: false,
  };
}

/** Прогноз до конца года: факт за прошедшие месяцы + план с учётом событий (applyEvents) на остаток года. */
export function fullForecastTotals(positions: PositionRecord[], viewMode: ViewMode, throughMonth: number) {
  const month = Math.max(0, Math.min(11, throughMonth));
  const applied = mapPositionsWithAppliedEvents(positions);
  const useFact = hasFactData();
  let actualYtd = 0;
  let planYtd = 0;
  let forecastRemainder = 0;
  for (const position of applied) {
    if (position.status === "Closed") continue;
    for (let m = 0; m <= month; m += 1) {
      actualYtd += monthForecastAmount(position, m, viewMode, useFact);
      planYtd += monthAmountForPosition(position, m, viewMode);
    }
    for (let m = month + 1; m < 12; m += 1) {
      forecastRemainder += monthAmountForPosition(position, m, viewMode);
    }
  }
  const forecastYear = actualYtd + forecastRemainder;
  const planYear = planYtd + forecastRemainder;
  return {
    throughMonth: month,
    throughLabel: MONTHS[month],
    actualYtd,
    planYtd,
    forecastRemainderPlan: forecastRemainder,
    forecastYear,
    planYear,
    varianceYtd: actualYtd - planYtd,
    usesPlanEvents: true,
  };
}

export function forecastDecSnapshot(positions: PositionRecord[]) {
  const growth = decGrowthByLimitFlag(mapPositionsWithAppliedEvents(positions));
  return {
    total: growth.total,
    inLimit: growth.IN_LIMIT,
    overLimit: growth.OVER_LIMIT,
    totalPctLabel: formatGrowthPct(growth.total.pct),
  };
}
