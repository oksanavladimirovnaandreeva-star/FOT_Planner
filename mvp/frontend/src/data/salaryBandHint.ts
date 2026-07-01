import type { SalaryRangeBand } from "../types";
import { findSalaryBand, getMonthlyCR } from "./salaryRangeData";

export type SalaryBandCrTone = "ok" | "warn" | "danger";

export type SalaryBandHintView = {
  /** Показывать блок min/mid/max, полоску и CR. */
  visible: boolean;
  inCatalog: boolean;
  message: string | null;
  min: number | null;
  mid: number | null;
  max: number | null;
  cr: number | null;
  crLabel: string | null;
  crTone: SalaryBandCrTone | null;
  /** 0–100: позиция оклада между min и max (при пустом окладе — 50). */
  markerPct: number | null;
  belowMin: boolean;
  aboveMax: boolean;
};

export function salaryBandCrTone(cr: number): SalaryBandCrTone {
  if (cr < 0.8) return "warn";
  if (cr > 1.2) return "danger";
  return "ok";
}

export function salaryBandMarkerPct(
  base: number,
  min: number,
  max: number,
): { markerPct: number; belowMin: boolean; aboveMax: boolean } {
  if (max <= min) {
    return { markerPct: 50, belowMin: base < min, aboveMax: base > max };
  }
  const belowMin = base < min;
  const aboveMax = base > max;
  const clamped = Math.max(min, Math.min(max, base));
  const markerPct = ((clamped - min) / (max - min)) * 100;
  return { markerPct, belowMin, aboveMax };
}

const HIDDEN: SalaryBandHintView = {
  visible: false,
  inCatalog: false,
  message: null,
  min: null,
  mid: null,
  max: null,
  cr: null,
  crLabel: null,
  crTone: null,
  markerPct: null,
  belowMin: false,
  aboveMax: false,
};

export function buildSalaryBandHint(input: {
  specialization: string;
  level: string;
  baseSalary: number | "" | null | undefined;
  bands: SalaryRangeBand[];
  canView: boolean;
}): SalaryBandHintView {
  if (!input.canView) {
    return { ...HIDDEN, message: "Диапазон недоступен для вашей роли" };
  }

  const band = findSalaryBand(input.specialization, input.level, input.bands);
  if (!band) {
    return { ...HIDDEN, message: "Нет в справочнике" };
  }

  const base =
    input.baseSalary === "" || input.baseSalary == null || Number.isNaN(Number(input.baseSalary))
      ? 0
      : Number(input.baseSalary);
  const { markerPct, belowMin, aboveMax } = salaryBandMarkerPct(
    base,
    band.minSalary,
    band.maxSalary,
  );
  const hasBase = base > 0;
  const cr = hasBase ? getMonthlyCR(base, input.specialization, input.level, input.bands) : 0;

  return {
    visible: true,
    inCatalog: true,
    message: null,
    min: band.minSalary,
    mid: band.midpoint,
    max: band.maxSalary,
    cr: hasBase && cr > 0 ? cr : null,
    crLabel: hasBase && cr > 0 ? cr.toFixed(2) : null,
    crTone: hasBase && cr > 0 ? salaryBandCrTone(cr) : null,
    markerPct: hasBase ? markerPct : 50,
    belowMin: hasBase && belowMin,
    aboveMax: hasBase && aboveMax,
  };
}
