import { annualTotal } from "./planningData";
import type { PositionRecord } from "../types";
import { MONTHS } from "../types";

export type CompareKpi = {
  planYear: number;
  baselineAnnual: number;
  draftAnnual: number;
  variance: number;
  variancePct: number;
  baselineHeadcount: number;
  draftHeadcount: number;
};

export type MonthlyComparePoint = {
  month: number;
  label: string;
  baseline: number;
  draft: number;
};

export type LimitVarianceRow = {
  id: string;
  label: string;
  variance: number;
};

export type DepartmentVarianceRow = {
  id: string;
  label: string;
  variance: number;
};

function activeRows(positions: PositionRecord[]): PositionRecord[] {
  return positions.filter((position) => position.status !== "Closed");
}

export function compareKpis(baseline: PositionRecord[], draft: PositionRecord[]): CompareKpi {
  const baselineAnnual = activeRows(baseline).reduce((sum, position) => sum + annualTotal(position), 0);
  const draftAnnual = activeRows(draft).reduce((sum, position) => sum + annualTotal(position), 0);
  const variance = draftAnnual - baselineAnnual;
  return {
    planYear: 2026,
    baselineAnnual,
    draftAnnual,
    variance,
    variancePct: baselineAnnual > 0 ? (variance / baselineAnnual) * 100 : 0,
    baselineHeadcount: activeRows(baseline).length,
    draftHeadcount: activeRows(draft).length,
  };
}

export function monthlyCompareSeries(
  baseline: PositionRecord[],
  draft: PositionRecord[],
): MonthlyComparePoint[] {
  return MONTHS.map((label, month) => {
    let baselineSum = 0;
    let draftSum = 0;
    for (const position of baseline) {
      if (position.status === "Closed" || month < position.activeFromMonth) continue;
      baselineSum += position.monthlyBase[month] + position.monthlyBonus[month];
    }
    for (const position of draft) {
      if (position.status === "Closed" || month < position.activeFromMonth) continue;
      draftSum += position.monthlyBase[month] + position.monthlyBonus[month];
    }
    return { month, label, baseline: baselineSum, draft: draftSum };
  });
}

export function varianceByLimit(baseline: PositionRecord[], draft: PositionRecord[]): LimitVarianceRow[] {
  const labels: Record<string, string> = {
    IN_LIMIT: "В лимите",
    OVER_LIMIT: "Сверх лимита",
  };
  return (["IN_LIMIT", "OVER_LIMIT"] as const).map((flag) => {
    const baseSum = activeRows(baseline)
      .filter((position) => position.limitFlag === flag)
      .reduce((sum, position) => sum + annualTotal(position), 0);
    const draftSum = activeRows(draft)
      .filter((position) => position.limitFlag === flag)
      .reduce((sum, position) => sum + annualTotal(position), 0);
    return { id: flag, label: labels[flag], variance: draftSum - baseSum };
  });
}

export function varianceByDepartment(baseline: PositionRecord[], draft: PositionRecord[]): DepartmentVarianceRow[] {
  const acc = new Map<string, { base: number; draft: number }>();
  for (const position of activeRows(baseline)) {
    const cell = acc.get(position.department) ?? { base: 0, draft: 0 };
    cell.base += annualTotal(position);
    acc.set(position.department, cell);
  }
  for (const position of activeRows(draft)) {
    const cell = acc.get(position.department) ?? { base: 0, draft: 0 };
    cell.draft += annualTotal(position);
    acc.set(position.department, cell);
  }
  return [...acc.entries()]
    .map(([department, cell]) => ({
      id: department,
      label: department,
      variance: cell.draft - cell.base,
    }))
    .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
    .slice(0, 8);
}

export function formatMln(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} млн`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)} тыс`;
  return `${Math.round(value).toLocaleString("ru-RU")}`;
}
