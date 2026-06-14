import { matchesOrgSlice, type OrgSliceSelection } from "./orgSliceFilters";
import { annualTotal, decToDec, getMonthlyCR } from "./planningData";
import { initialSalaryBands } from "./salaryRangeData";
import { hasFactData, monthFactAmountFromStore } from "./factStore";
import { isPlanClosedAtMonth } from "./occupancyTimeline";
import { MONTHS } from "../types";
import type { LimitFlagKey, PositionRecord, SalaryRangeBand } from "../types";

export const LIMIT_FLAG_KEYS: LimitFlagKey[] = ["IN_LIMIT", "OVER_LIMIT", "UNLIMITED"];

export type ViewMode = "base" | "total";

export type DashboardFilters = OrgSliceSelection & {
  limitFlag: "All" | LimitFlagKey;
  status: "All" | PositionRecord["status"];
  slotType: "All" | PositionRecord["slotType"];
};

export const DEFAULT_DASHBOARD_FILTERS: DashboardFilters = {
  departments: [],
  units: [],
  teams: [],
  limitFlag: "All",
  status: "All",
  slotType: "All",
};

export function pickFotAmount(base: number, bonus: number, viewMode: ViewMode): number {
  return viewMode === "total" ? base + bonus : base;
}

export function filterPositionsForDashboard(
  positions: PositionRecord[],
  filters: DashboardFilters,
): PositionRecord[] {
  return positions.filter((position) => {
    if (!matchesOrgSlice(position, filters)) return false;
    if (filters.limitFlag !== "All" && position.limitFlag !== filters.limitFlag) return false;
    if (filters.status !== "All" && position.status !== filters.status) return false;
    if (filters.slotType !== "All" && position.slotType !== filters.slotType) return false;
    return true;
  });
}

export function monthlyFotSeries(
  positions: PositionRecord[],
  viewMode: ViewMode,
): { month: number; label: string; base: number; bonus: number; amount: number }[] {
  return MONTHS.map((label, month) => {
    let base = 0;
    let bonus = 0;
    for (const position of positions) {
      if (month < position.activeFromMonth) continue;
      if (isPlanClosedAtMonth(position, month)) continue;
      base += position.monthlyBase[month];
      bonus += position.monthlyBonus[month];
    }
    return {
      month,
      label,
      base,
      bonus,
      amount: viewMode === "total" ? base + bonus : base,
    };
  });
}

export function totalsByLimitFlag(
  positions: PositionRecord[],
  viewMode: ViewMode,
): Record<LimitFlagKey | "TOTAL", number> {
  const acc: Record<LimitFlagKey | "TOTAL", number> = {
    IN_LIMIT: 0,
    OVER_LIMIT: 0,
    UNLIMITED: 0,
    TOTAL: 0,
  };
  for (const position of positions) {
    const yearAmount = viewMode === "total" ? annualTotal(position) : position.monthlyBase.reduce((s, v) => s + v, 0);
    if (yearAmount === 0) continue;
    acc[position.limitFlag] += yearAmount;
    acc.TOTAL += yearAmount;
  }
  return acc;
}

export type LimitPlanFact = { plan: number; fact: number; variance: number };

export function monthAmountForPosition(position: PositionRecord, month: number, viewMode: ViewMode): number {
  if (month < position.activeFromMonth) return 0;
  if (isPlanClosedAtMonth(position, month)) return 0;
  return pickFotAmount(position.monthlyBase[month] ?? 0, position.monthlyBonus[month] ?? 0, viewMode);
}

export function monthFactAmount(position: PositionRecord, month: number, viewMode: ViewMode): number {
  return monthFactAmountFromStore(position, month, viewMode);
}

export function monthlyPlanFactSeries(positions: PositionRecord[], viewMode: ViewMode) {
  return MONTHS.map((label, month) => {
    let plan = 0;
    let fact = 0;
    for (const position of positions) {
      plan += monthAmountForPosition(position, month, viewMode);
      fact += monthFactAmount(position, month, viewMode);
    }
    return { month, label, plan, fact, variance: plan - fact };
  });
}

export function monthlyPlanFactByLimit(positions: PositionRecord[], viewMode: ViewMode) {
  return MONTHS.map((label, month) => {
    const byLimit: Record<LimitFlagKey, LimitPlanFact> = {
      IN_LIMIT: { plan: 0, fact: 0, variance: 0 },
      OVER_LIMIT: { plan: 0, fact: 0, variance: 0 },
      UNLIMITED: { plan: 0, fact: 0, variance: 0 },
    };
    for (const position of positions) {
      if (month < position.activeFromMonth) continue;
      const plan = monthAmountForPosition(position, month, viewMode);
      const fact = monthFactAmount(position, month, viewMode);
      byLimit[position.limitFlag].plan += plan;
      byLimit[position.limitFlag].fact += fact;
      byLimit[position.limitFlag].variance += plan - fact;
    }
    return { month, label, byLimit };
  });
}

export function planFactByLimitYear(positions: PositionRecord[], viewMode: ViewMode): Record<LimitFlagKey, LimitPlanFact> {
  const byLimit: Record<LimitFlagKey, LimitPlanFact> = {
    IN_LIMIT: { plan: 0, fact: 0, variance: 0 },
    OVER_LIMIT: { plan: 0, fact: 0, variance: 0 },
    UNLIMITED: { plan: 0, fact: 0, variance: 0 },
  };
  for (const position of positions) {
    const plan = viewMode === "total" ? annualTotal(position) : position.monthlyBase.reduce((s, v) => s + v, 0);
    if (plan === 0) continue;
    const fact = 0;
    byLimit[position.limitFlag].plan += plan;
    byLimit[position.limitFlag].fact += fact;
    byLimit[position.limitFlag].variance += fact - plan;
  }
  return byLimit;
}

export function sliceAnalytics(positions: PositionRecord[], viewMode: ViewMode) {
  const openHeadcount = positions.filter((position) => position.status !== "Closed");
  const decPrev = openHeadcount.reduce((sum, position) => sum + position.previousDecemberBase, 0);
  const decPlan = openHeadcount.reduce((sum, position) => sum + position.monthlyBase[11], 0);
  const decPct = decToDec(decPrev, decPlan);
  const byLimitYear = planFactByLimitYear(positions, viewMode);
  const yearPlan = byLimitYear.IN_LIMIT.plan + byLimitYear.OVER_LIMIT.plan + byLimitYear.UNLIMITED.plan;
  const inLimitSharePct = yearPlan > 0 ? (byLimitYear.IN_LIMIT.plan / yearPlan) * 100 : 0;

  const ytdThroughMonth = new Date().getMonth();
  let planYtd = 0;
  let factYtd = 0;
  for (const position of positions) {
    for (let month = 0; month <= ytdThroughMonth; month += 1) {
      planYtd += monthAmountForPosition(position, month, viewMode);
      factYtd += monthFactAmount(position, month, viewMode);
    }
  }

  return {
    hasFactData: hasFactData(),
    decPrev,
    decPlan,
    decPct,
    yearPlan,
    inLimitSharePct,
    planYtd,
    factYtd,
    ytdVariance: factYtd - planYtd,
    ytdVariancePct: planYtd > 0 ? ((factYtd - planYtd) / planYtd) * 100 : 0,
    byLimitYear,
  };
}

export function formatGrowthPct(pct: number): string {
  if (pct > 0) return `+${pct.toFixed(1)}%`;
  return `${pct.toFixed(1)}%`;
}

export function dashboardKpis(
  positions: PositionRecord[],
  viewMode: ViewMode,
  salaryBands: SalaryRangeBand[] = initialSalaryBands(),
) {
  const active = positions.filter((p) => p.status !== "Closed");
  let yearBase = 0;
  let yearBonus = 0;
  let crSum = 0;
  let crCount = 0;
  for (const position of active) {
    for (let month = position.activeFromMonth; month < 12; month += 1) {
      yearBase += position.monthlyBase[month];
      yearBonus += position.monthlyBonus[month];
      const cr = getMonthlyCR(position.monthlyBase[month], position.monthlySpec[month], position.monthlyLevel[month], salaryBands);
      if (cr > 0) {
        crSum += cr;
        crCount += 1;
      }
    }
  }
  return {
    positionCount: active.length,
    occupiedCount: active.filter((p) => p.status === "Occupied").length,
    vacancyCount: active.filter((p) => p.status === "Vacancy").length,
    inLimitCount: active.filter((p) => p.limitFlag === "IN_LIMIT").length,
    overLimitCount: active.filter((p) => p.limitFlag === "OVER_LIMIT").length,
    carryoverCount: active.filter((p) => p.slotType === "carryover").length,
    newSlotCount: active.filter((p) => p.slotType === "new").length,
    yearBase,
    yearBonus,
    yearAmount: viewMode === "total" ? yearBase + yearBonus : yearBase,
    avgCr: crCount ? crSum / crCount : 0,
  };
}
