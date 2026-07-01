import type { PositionRecord, SalaryRangeBand } from "../types";
import { DEMO_PERSONAS, personaNeedsScope, type DemoPersonaId } from "./demoPersonas";
import type { PersonaAccessScope } from "./personaAccessScope";
import { positionMatchesAccessScope } from "./personaAccessScope";
import { bandKey } from "./salaryRangeData";
import type { UserRole } from "./userAccess";

export const BAND_ACCESS_GRANTS_KEY = "fot_mvp_band_access_grants";

/** bandKey → список персон, которым видна строка справочника (C&B — всегда все). */
export type BandAccessGrants = Record<string, DemoPersonaId[]>;

/** Демо-акценты: построчная гранулярность (Lead по Engineering ≠ Lead по Marketing). */
const DEMO_BAND_ACCESS_ACCENT: Record<
  string,
  { add?: DemoPersonaId[]; remove?: DemoPersonaId[] }
> = {
  "Engineering::Lead": { remove: ["vasya"] },
  "Marketing::Lead": { add: ["vasya"] },
};

function positionSpecAtYearEnd(position: PositionRecord): string | null {
  const spec = position.monthlySpec[11] ?? position.monthlySpec[0] ?? position.seedMonthlySpec[0];
  return spec?.trim() || null;
}

function positionLevelAtYearEnd(position: PositionRecord): string | null {
  const level = position.monthlyLevel[11] ?? position.monthlyLevel[0] ?? position.seedMonthlyLevel[0];
  return level?.trim() || null;
}

export function bandMatchesPosition(
  band: Pick<SalaryRangeBand, "specialization" | "level">,
  position: PositionRecord,
): boolean {
  const spec = positionSpecAtYearEnd(position);
  const level = positionLevelAtYearEnd(position);
  return spec === band.specialization && level === band.level;
}

export function bandVisibleToScope(
  band: Pick<SalaryRangeBand, "specialization" | "level">,
  positions: PositionRecord[],
  scope: PersonaAccessScope,
): boolean {
  for (const position of positions) {
    if (position.status === "Closed") continue;
    if (!positionMatchesAccessScope(position, scope)) continue;
    if (bandMatchesPosition(band, position)) return true;
  }
  return false;
}

function applyDemoBandAccent(bandKeyStr: string, viewers: DemoPersonaId[]): DemoPersonaId[] {
  const accent = DEMO_BAND_ACCESS_ACCENT[bandKeyStr];
  if (!accent) return viewers;
  const set = new Set(viewers);
  accent.remove?.forEach((id) => set.delete(id));
  accent.add?.forEach((id) => set.add(id));
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function viewersForBandFromPositions(
  band: SalaryRangeBand,
  positions: PositionRecord[],
  scopeForPersona: (id: DemoPersonaId) => PersonaAccessScope | null | undefined,
): DemoPersonaId[] {
  const viewers: DemoPersonaId[] = [];
  for (const persona of DEMO_PERSONAS) {
    if (persona.role === "cb_admin") continue;
    if (!personaNeedsScope(persona)) continue;
    const scope = scopeForPersona(persona.id) ?? persona.defaultScope ?? null;
    if (!scope) continue;
    if (bandVisibleToScope(band, positions, scope)) {
      viewers.push(persona.id);
    }
  }
  const key = bandKey(band.specialization, band.level);
  return applyDemoBandAccent(key, viewers);
}

export function buildDefaultBandAccessGrants(
  bands: SalaryRangeBand[],
  positions: PositionRecord[],
  scopeForPersona: (id: DemoPersonaId) => PersonaAccessScope | null | undefined,
): BandAccessGrants {
  const grants: BandAccessGrants = {};
  for (const band of bands) {
    const key = bandKey(band.specialization, band.level);
    grants[key] = viewersForBandFromPositions(band, positions, scopeForPersona);
  }
  return grants;
}

export function readBandAccessGrants(): BandAccessGrants | null {
  try {
    const raw = localStorage.getItem(BAND_ACCESS_GRANTS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BandAccessGrants;
    return parsed ?? null;
  } catch {
    return null;
  }
}

export function writeBandAccessGrants(grants: BandAccessGrants): void {
  localStorage.setItem(BAND_ACCESS_GRANTS_KEY, JSON.stringify(grants));
}

export function clearBandAccessGrants(): void {
  localStorage.removeItem(BAND_ACCESS_GRANTS_KEY);
}

export function resolveBandAccessGrants(
  bands: SalaryRangeBand[],
  positions: PositionRecord[],
  scopeForPersona: (id: DemoPersonaId) => PersonaAccessScope | null | undefined,
): BandAccessGrants {
  const saved = readBandAccessGrants();
  if (saved && Object.keys(saved).length > 0) {
    return saved;
  }
  return buildDefaultBandAccessGrants(bands, positions, scopeForPersona);
}

export function canViewBand(
  band: Pick<SalaryRangeBand, "specialization" | "level">,
  personaId: DemoPersonaId,
  personaRole: UserRole,
  grants: BandAccessGrants,
): boolean {
  if (personaRole === "cb_admin") return true;
  const key = bandKey(band.specialization, band.level);
  return grants[key]?.includes(personaId) ?? false;
}

export function countVisibleBandsForPersona(
  bands: SalaryRangeBand[],
  personaId: DemoPersonaId,
  personaRole: UserRole,
  grants: BandAccessGrants,
): number {
  if (personaRole === "cb_admin") return bands.length;
  return bands.filter((band) => canViewBand(band, personaId, personaRole, grants)).length;
}

export function toggleBandViewer(
  grants: BandAccessGrants,
  band: SalaryRangeBand,
  personaId: DemoPersonaId,
  enabled: boolean,
): BandAccessGrants {
  const key = bandKey(band.specialization, band.level);
  const current = new Set(grants[key] ?? []);
  if (enabled) current.add(personaId);
  else current.delete(personaId);
  return {
    ...grants,
    [key]: [...current].sort((a, b) => a.localeCompare(b)),
  };
}
