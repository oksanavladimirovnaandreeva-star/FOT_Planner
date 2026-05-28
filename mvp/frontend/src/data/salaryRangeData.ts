import type { SalaryRangeBand } from "../types";

/** Годовой мидпоинт (как в старом MVP) → месячные min / mid / max для справочника. */
const ANNUAL_MIDPOINTS: Record<string, Record<string, number>> = {
  Engineering: {
    Junior: 1_200_000,
    Middle: 1_800_000,
    Senior: 2_500_000,
    Lead: 3_200_000,
  },
  Product: {
    Middle: 1_900_000,
    Senior: 2_700_000,
    Lead: 3_300_000,
  },
  Marketing: {
    Middle: 1_400_000,
    Senior: 2_000_000,
    Lead: 2_800_000,
  },
};

function bandFromAnnualMid(spec: string, level: string, annualMid: number): SalaryRangeBand {
  const midpoint = Math.round(annualMid / 12);
  return {
    id: `${spec}::${level}`,
    specialization: spec,
    level,
    minSalary: Math.round(midpoint * 0.8),
    midpoint,
    maxSalary: Math.round(midpoint * 1.2),
    currency: "RUB",
  };
}

export function initialSalaryBands(): SalaryRangeBand[] {
  const rows: SalaryRangeBand[] = [];
  for (const [spec, levels] of Object.entries(ANNUAL_MIDPOINTS)) {
    for (const [level, annualMid] of Object.entries(levels)) {
      rows.push(bandFromAnnualMid(spec, level, annualMid));
    }
  }
  return rows.sort((a, b) =>
    a.specialization.localeCompare(b.specialization, "ru") || a.level.localeCompare(b.level, "ru"),
  );
}

export function specializationOptions(bands: SalaryRangeBand[]): string[] {
  return [...new Set(bands.map((band) => band.specialization))].sort((a, b) => a.localeCompare(b, "ru"));
}

export function levelOptionsForSpecialization(specialization: string, bands: SalaryRangeBand[]): string[] {
  const levels = bands.filter((band) => band.specialization === specialization).map((band) => band.level);
  return levels.length ? [...new Set(levels)].sort((a, b) => a.localeCompare(b, "ru")) : ["Junior", "Middle", "Senior", "Lead"];
}

export function findSalaryBand(
  specialization: string,
  level: string,
  bands: SalaryRangeBand[],
): SalaryRangeBand | undefined {
  return bands.find((band) => band.specialization === specialization && band.level === level);
}

/** CR = месячный оклад / месячный мидпоинт справочника. */
export function getMonthlyCR(
  base: number,
  specialization: string,
  level: string,
  bands: SalaryRangeBand[],
): number {
  const band = findSalaryBand(specialization, level, bands);
  if (!band?.midpoint) return 0;
  return base / band.midpoint;
}

export function bandKey(specialization: string, level: string): string {
  return `${specialization}::${level}`;
}

export function upsertSalaryBand(bands: SalaryRangeBand[], next: SalaryRangeBand): SalaryRangeBand[] {
  const key = bandKey(next.specialization, next.level);
  const without = bands.filter((band) => bandKey(band.specialization, band.level) !== key);
  return [...without, { ...next, id: key }].sort((a, b) =>
    a.specialization.localeCompare(b.specialization, "ru") || a.level.localeCompare(b.level, "ru"),
  );
}

export function removeSalaryBand(bands: SalaryRangeBand[], specialization: string, level: string): SalaryRangeBand[] {
  const key = bandKey(specialization, level);
  return bands.filter((band) => bandKey(band.specialization, band.level) !== key);
}
