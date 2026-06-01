import {
  annualTotal,
  computeDecGrowthBucket,
  formatGrowthDelta,
  formatGrowthPct,
  POSITION_STATUS_LABELS,
} from "./planningData";
import type { PositionRecord } from "../types";

export type PositionDiffKind = "added" | "removed" | "changed" | "unchanged";

export interface PositionDiffRow {
  positionId: string;
  kind: PositionDiffKind;
  role: string;
  department: string;
  baselineStatus?: string;
  draftStatus?: string;
  baselineAnnualFot: number;
  draftAnnualFot: number;
  deltaFot: number;
}

export interface PlanVersionDiffSummary {
  baselineLabel: string;
  draftLabel: string;
  baselineHeadcount: number;
  draftHeadcount: number;
  headcountDelta: number;
  baselineAnnualFot: number;
  draftAnnualFot: number;
  annualFotDelta: number;
  baselineDecPrev: number;
  draftDecPrev: number;
  baselineDecPlan: number;
  draftDecPlan: number;
  baselineDecPct: number;
  draftDecPct: number;
  decPctDelta: number;
  changedCount: number;
  addedCount: number;
  removedCount: number;
}

function activeHeadcount(positions: PositionRecord[]): number {
  return positions.filter((position) => position.status !== "Closed").length;
}

function annualFotSum(positions: PositionRecord[]): number {
  let sum = 0;
  for (const position of positions) {
    if (position.status === "Closed") continue;
    sum += annualTotal(position);
  }
  return sum;
}

export function diffPlanVersions(
  baselinePositions: PositionRecord[],
  draftPositions: PositionRecord[],
  labels: { baselineLabel: string; draftLabel: string },
): { rows: PositionDiffRow[]; summary: PlanVersionDiffSummary } {
  const baselineById = new Map(baselinePositions.map((position) => [position.positionId, position] as const));
  const draftById = new Map(draftPositions.map((position) => [position.positionId, position] as const));
  const allIds = new Set([...baselineById.keys(), ...draftById.keys()]);

  const rows: PositionDiffRow[] = [];

  for (const positionId of allIds) {
    const baseline = baselineById.get(positionId);
    const draft = draftById.get(positionId);
    const baselineAnnual = baseline && baseline.status !== "Closed" ? annualTotal(baseline) : 0;
    const draftAnnual = draft && draft.status !== "Closed" ? annualTotal(draft) : 0;

    let kind: PositionDiffKind = "unchanged";
    if (!baseline && draft) kind = "added";
    else if (baseline && !draft) kind = "removed";
    else if (baseline && draft) {
      const sameStatus = baseline.status === draft.status;
      const sameFot = Math.round(baselineAnnual) === Math.round(draftAnnual);
      const sameEvents = baseline.events.length === draft.events.length;
      kind = sameStatus && sameFot && sameEvents ? "unchanged" : "changed";
    }

    if (kind === "unchanged") continue;

    rows.push({
      positionId,
      kind,
      role: draft?.role ?? baseline?.role ?? positionId,
      department: draft?.department ?? baseline?.department ?? "",
      baselineStatus: baseline ? POSITION_STATUS_LABELS[baseline.status] : undefined,
      draftStatus: draft ? POSITION_STATUS_LABELS[draft.status] : undefined,
      baselineAnnualFot: baselineAnnual,
      draftAnnualFot: draftAnnual,
      deltaFot: draftAnnual - baselineAnnual,
    });
  }

  rows.sort((a, b) => Math.abs(b.deltaFot) - Math.abs(a.deltaFot));

  const baselineBucket = computeDecGrowthBucket(baselinePositions.filter((p) => p.status !== "Closed"));
  const draftBucket = computeDecGrowthBucket(draftPositions.filter((p) => p.status !== "Closed"));

  const summary: PlanVersionDiffSummary = {
    baselineLabel: labels.baselineLabel,
    draftLabel: labels.draftLabel,
    baselineHeadcount: activeHeadcount(baselinePositions),
    draftHeadcount: activeHeadcount(draftPositions),
    headcountDelta: activeHeadcount(draftPositions) - activeHeadcount(baselinePositions),
    baselineAnnualFot: annualFotSum(baselinePositions),
    draftAnnualFot: annualFotSum(draftPositions),
    annualFotDelta: annualFotSum(draftPositions) - annualFotSum(baselinePositions),
    baselineDecPrev: baselineBucket.decPrev,
    draftDecPrev: draftBucket.decPrev,
    baselineDecPlan: baselineBucket.decPlan,
    draftDecPlan: draftBucket.decPlan,
    baselineDecPct: baselineBucket.pct,
    draftDecPct: draftBucket.pct,
    decPctDelta: draftBucket.pct - baselineBucket.pct,
    changedCount: rows.filter((row) => row.kind === "changed").length,
    addedCount: rows.filter((row) => row.kind === "added").length,
    removedCount: rows.filter((row) => row.kind === "removed").length,
  };

  return { rows, summary };
}

export function formatDiffSummaryLine(summary: PlanVersionDiffSummary): string {
  const head =
    summary.headcountDelta === 0
      ? "численность без изменений"
      : `${summary.headcountDelta > 0 ? "+" : ""}${summary.headcountDelta} поз.`;
  const fot = formatGrowthDelta(summary.annualFotDelta);
  const dec = `${formatGrowthPct(summary.baselineDecPct)} → ${formatGrowthPct(summary.draftDecPct)} (${summary.decPctDelta >= 0 ? "+" : ""}${summary.decPctDelta.toFixed(1)} п.п.)`;
  return `${head} · ФОТ год ${fot} · дек→дек ${dec}`;
}
