import { annualTotal, monthLabel } from "./planningData";
import { monthAmountForPosition, monthFactAmount } from "./dashboardMetrics";
import { hasFactData } from "./factStore";
import { mapPositionsWithAppliedEvents } from "./planOperations";
import type { ViewMode } from "./dashboardMetrics";
import type { LimitFlagKey, PositionRecord } from "../types";

export function hasPlanFactData(): boolean {
  return hasFactData();
}

export type PlanFactRow = {
  id: string;
  label: string;
  sublabel?: string;
  plan: number;
  fact: number;
  /** План − факт. Плюс — экономия, минус — перерасход. */
  variance: number;
  variancePct: number;
};

export type PlanFactPositionRow = {
  positionId: string;
  role: string;
  department: string;
  unit: string;
  team: string;
  planYtd: number;
  factYtd: number;
  /** План − факт YTD. */
  delta: number;
};

/** Единая формула: план − факт. Плюс — экономия, минус — перерасход. */
export function planFactDelta(plan: number, fact: number): number {
  return plan - fact;
}

/** @deprecated Используйте planFactDelta */
export const planMinusFactDelta = planFactDelta;

function ytdMonthIndex(): number {
  return new Date().getMonth();
}

export function planFactTotals(positions: PositionRecord[], viewMode: ViewMode) {
  const applied = mapPositionsWithAppliedEvents(positions);
  const ytd = ytdMonthIndex();
  let plan = 0;
  let fact = 0;
  for (const position of applied) {
    for (let month = 0; month <= ytd; month += 1) {
      plan += monthAmountForPosition(position, month, viewMode);
      fact += monthFactAmount(position, month, viewMode);
    }
  }
  const variance = planFactDelta(plan, fact);
  return {
    plan,
    fact,
    variance,
    variancePct: plan > 0 ? (variance / plan) * 100 : 0,
    ytdLabel: `YTD · янв — ${monthLabel(ytd)}`,
  };
}

export function planFactByDepartment(positions: PositionRecord[], viewMode: ViewMode): PlanFactRow[] {
  const applied = mapPositionsWithAppliedEvents(positions);
  const ytd = ytdMonthIndex();
  const acc = new Map<string, { plan: number; fact: number }>();
  for (const position of applied) {
    const key = position.department;
    const cell = acc.get(key) ?? { plan: 0, fact: 0 };
    for (let month = 0; month <= ytd; month += 1) {
      cell.plan += monthAmountForPosition(position, month, viewMode);
      cell.fact += monthFactAmount(position, month, viewMode);
    }
    acc.set(key, cell);
  }
  return [...acc.entries()]
    .map(([department, cell]) => {
      const variance = planFactDelta(cell.plan, cell.fact);
      return {
        id: department,
        label: department,
        sublabel: "Департамент",
        plan: cell.plan,
        fact: cell.fact,
        variance,
        variancePct: cell.plan > 0 ? (variance / cell.plan) * 100 : 0,
      };
    })
    .sort((a, b) => b.plan - a.plan);
}

export function planFactByLimit(positions: PositionRecord[], viewMode: ViewMode): PlanFactRow[] {
  const applied = mapPositionsWithAppliedEvents(positions);
  const ytd = ytdMonthIndex();
  const acc: Record<LimitFlagKey, { plan: number; fact: number }> = {
    IN_LIMIT: { plan: 0, fact: 0 },
    OVER_LIMIT: { plan: 0, fact: 0 },
    UNLIMITED: { plan: 0, fact: 0 },
  };
  for (const position of applied) {
    for (let month = 0; month <= ytd; month += 1) {
      acc[position.limitFlag].plan += monthAmountForPosition(position, month, viewMode);
      acc[position.limitFlag].fact += monthFactAmount(position, month, viewMode);
    }
  }
  const labels: Record<LimitFlagKey, string> = {
    IN_LIMIT: "В лимите",
    OVER_LIMIT: "Сверх лимита",
    UNLIMITED: "Без лимита",
  };
  return (Object.keys(acc) as LimitFlagKey[])
    .map((flag) => {
      const cell = acc[flag];
      const variance = planFactDelta(cell.plan, cell.fact);
      return {
        id: flag,
        label: labels[flag],
        sublabel: flag,
        plan: cell.plan,
        fact: cell.fact,
        variance,
        variancePct: cell.plan > 0 ? (variance / cell.plan) * 100 : 0,
      };
    })
    .filter((row) => row.plan > 0 || row.fact > 0);
}

export function deviationDrivers(rows: PlanFactRow[]): PlanFactRow[] {
  return rows.filter((row) => row.plan > 0).sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
}

export function planFactPositionRows(positions: PositionRecord[], viewMode: ViewMode): PlanFactPositionRow[] {
  if (!hasFactData()) return [];
  const applied = mapPositionsWithAppliedEvents(positions);
  const ytd = ytdMonthIndex();
  const rows: PlanFactPositionRow[] = [];

  for (const position of applied) {
    if (position.status === "Closed") continue;
    let planYtd = 0;
    let factYtd = 0;
    for (let month = 0; month <= ytd; month += 1) {
      planYtd += monthAmountForPosition(position, month, viewMode);
      factYtd += monthFactAmount(position, month, viewMode);
    }
    if (planYtd === 0 && factYtd === 0) continue;
    const delta = planFactDelta(planYtd, factYtd);
    rows.push({
      positionId: position.positionId,
      role: position.role,
      department: position.department,
      unit: position.unit,
      team: position.team,
      planYtd,
      factYtd,
      delta,
    });
  }

  return rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

export function planFactEconomyAndOverspendTotals(positions: PositionRecord[], viewMode: ViewMode) {
  if (!hasFactData()) {
    return { economy: 0, overspend: 0, positionCount: 0 };
  }
  const rows = planFactPositionRows(positions, viewMode);
  let economy = 0;
  let overspend = 0;
  for (const row of rows) {
    if (row.delta > 0) economy += row.delta;
    if (row.delta < 0) overspend += Math.abs(row.delta);
  }
  return { economy, overspend, positionCount: rows.length };
}

export { formatMoney } from "./formatDisplay";

/** Тон для Δ план−факт: плюс — экономия (under), минус — перерасход (over). */
export function varianceTone(deltaPlanMinusFact: number): "over" | "under" | "flat" {
  if (deltaPlanMinusFact > 0) return "under";
  if (deltaPlanMinusFact < 0) return "over";
  return "flat";
}

/** Для демо-графика отклонений: годовой план по департаменту (если факта нет). */
export function annualPlanByDepartment(positions: PositionRecord[], viewMode: ViewMode): PlanFactRow[] {
  const acc = new Map<string, number>();
  for (const position of positions) {
    if (position.status === "Closed") continue;
    const amount =
      viewMode === "total"
        ? annualTotal(position)
        : position.monthlyBase.reduce((sum, value, index) => {
            if (index < position.activeFromMonth) return sum;
            return sum + value;
          }, 0);
    acc.set(position.department, (acc.get(position.department) ?? 0) + amount);
  }
  return [...acc.entries()]
    .map(([department, plan]) => ({
      id: department,
      label: department,
      plan,
      fact: 0,
      variance: plan,
      variancePct: 100,
    }))
    .sort((a, b) => b.plan - a.plan);
}
