import { annualTotal, LIMIT_FLAG_LABELS } from "./planningData";
import type { LimitFlagKey, PositionRecord } from "../types";

export type LimitImpactByFlag = {
  limitFlag: LimitFlagKey;
  label: string;
  baselineHeadcount: number;
  draftHeadcount: number;
  headcountDelta: number;
  baselineAnnualFot: number;
  draftAnnualFot: number;
  fotDelta: number;
};

export type LimitFlagChangeRow = {
  positionId: string;
  role: string;
  department: string;
  baselineFlag: LimitFlagKey;
  draftFlag: LimitFlagKey;
  baselineAnnualFot: number;
  draftAnnualFot: number;
  fotDelta: number;
};

export type CorrectionLimitImpact = {
  byLimit: LimitImpactByFlag[];
  totalFotDelta: number;
  limitFlagChanges: LimitFlagChangeRow[];
  newOverLimitPositions: number;
};

const COMPARE_LIMIT_FLAGS: LimitFlagKey[] = ["IN_LIMIT", "OVER_LIMIT", "UNLIMITED"];

function activePositions(positions: PositionRecord[]): PositionRecord[] {
  return positions.filter((position) => position.status !== "Closed");
}

function annualFotFor(position: PositionRecord): number {
  return annualTotal(position);
}

export function buildCorrectionLimitImpact(
  baselinePositions: PositionRecord[],
  draftPositions: PositionRecord[],
): CorrectionLimitImpact {
  const baselineActive = activePositions(baselinePositions);
  const draftActive = activePositions(draftPositions);

  const byLimit = COMPARE_LIMIT_FLAGS.map((limitFlag) => {
    const baselineRows = baselineActive.filter((position) => position.limitFlag === limitFlag);
    const draftRows = draftActive.filter((position) => position.limitFlag === limitFlag);
    const baselineAnnualFot = baselineRows.reduce((sum, position) => sum + annualFotFor(position), 0);
    const draftAnnualFot = draftRows.reduce((sum, position) => sum + annualFotFor(position), 0);
    return {
      limitFlag,
      label: LIMIT_FLAG_LABELS[limitFlag],
      baselineHeadcount: baselineRows.length,
      draftHeadcount: draftRows.length,
      headcountDelta: draftRows.length - baselineRows.length,
      baselineAnnualFot,
      draftAnnualFot,
      fotDelta: draftAnnualFot - baselineAnnualFot,
    };
  });

  const baselineById = new Map(baselinePositions.map((position) => [position.positionId, position]));
  const draftById = new Map(draftPositions.map((position) => [position.positionId, position]));
  const limitFlagChanges: LimitFlagChangeRow[] = [];

  for (const [positionId, draft] of draftById) {
    const baseline = baselineById.get(positionId);
    if (!baseline || baseline.status === "Closed" || draft.status === "Closed") continue;
    if (baseline.limitFlag === draft.limitFlag) continue;
    const baselineAnnual = annualFotFor(baseline);
    const draftAnnual = annualFotFor(draft);
    limitFlagChanges.push({
      positionId,
      role: draft.role,
      department: draft.department,
      baselineFlag: baseline.limitFlag,
      draftFlag: draft.limitFlag,
      baselineAnnualFot: baselineAnnual,
      draftAnnualFot: draftAnnual,
      fotDelta: draftAnnual - baselineAnnual,
    });
  }

  for (const [positionId, draft] of draftById) {
    if (baselineById.has(positionId) || draft.status === "Closed") continue;
    if (draft.limitFlag !== "OVER_LIMIT") continue;
    limitFlagChanges.push({
      positionId,
      role: draft.role,
      department: draft.department,
      baselineFlag: "IN_LIMIT",
      draftFlag: draft.limitFlag,
      baselineAnnualFot: 0,
      draftAnnualFot: annualFotFor(draft),
      fotDelta: annualFotFor(draft),
    });
  }

  limitFlagChanges.sort((a, b) => Math.abs(b.fotDelta) - Math.abs(a.fotDelta));

  const newOverLimitPositions = limitFlagChanges.filter(
    (row) => row.draftFlag === "OVER_LIMIT" && (row.baselineFlag !== "OVER_LIMIT" || row.baselineAnnualFot === 0),
  ).length;

  const totalFotDelta = draftActive.reduce((sum, position) => sum + annualFotFor(position), 0)
    - baselineActive.reduce((sum, position) => sum + annualFotFor(position), 0);

  return {
    byLimit,
    totalFotDelta,
    limitFlagChanges,
    newOverLimitPositions,
  };
}

export function formatLimitImpactSummary(impact: CorrectionLimitImpact): string {
  const inLimit = impact.byLimit.find((row) => row.limitFlag === "IN_LIMIT");
  const overLimit = impact.byLimit.find((row) => row.limitFlag === "OVER_LIMIT");
  const parts: string[] = [];
  if (inLimit && inLimit.fotDelta !== 0) {
    parts.push(`в лимите ${inLimit.fotDelta >= 0 ? "+" : ""}${Math.round(inLimit.fotDelta).toLocaleString("ru-RU")} ₽/год`);
  }
  if (overLimit && (overLimit.fotDelta !== 0 || overLimit.headcountDelta !== 0)) {
    parts.push(
      `сверх лимита ${overLimit.headcountDelta >= 0 ? "+" : ""}${overLimit.headcountDelta} поз., ФОТ ${overLimit.fotDelta >= 0 ? "+" : ""}${Math.round(overLimit.fotDelta).toLocaleString("ru-RU")} ₽`,
    );
  }
  if (impact.newOverLimitPositions > 0) {
    parts.push(`новых/переведённых в OVER_LIMIT: ${impact.newOverLimitPositions}`);
  }
  return parts.length ? parts.join(" · ") : "без изменений по признаку лимита";
}
