import type { CatalogVisibilityRule, PositionRecord, SalaryRangeBand } from "../types";
import type { PersonaAccessScope } from "./personaAccessScope";
import { positionMatchesAccessScope } from "./personaAccessScope";
import { applyEvents, initialPositions } from "./planningData";
import type { UserRole } from "./userAccess";
import { bandMatchesCatalogVisibility } from "./catalogVisibility";

export type PersonaCatalogSubject = {
  role: UserRole;
  defaultScope?: PersonaAccessScope;
};

export function seedPositionsForCatalogDefaults(): PositionRecord[] {
  return initialPositions().map(applyEvents);
}

function positionSpecAtYearEnd(position: PositionRecord): string | null {
  const spec = position.monthlySpec[11] ?? position.monthlySpec[0] ?? position.seedMonthlySpec[0];
  return spec?.trim() || null;
}

function positionLevelAtYearEnd(position: PositionRecord): string | null {
  const level = position.monthlyLevel[11] ?? position.monthlyLevel[0] ?? position.seedMonthlyLevel[0];
  return level?.trim() || null;
}

/** Специализации и уровни из позиций плана внутри орг-среза. */
export function catalogSliceFromPositions(
  positions: PositionRecord[],
  scope: PersonaAccessScope | null | undefined,
): { specs: string[]; levels: string[] } {
  const specs = new Set<string>();
  const levels = new Set<string>();
  for (const position of positions) {
    if (position.status === "Closed") continue;
    if (scope && scope.rules.length > 0 && !positionMatchesAccessScope(position, scope)) continue;
    const spec = positionSpecAtYearEnd(position);
    const level = positionLevelAtYearEnd(position);
    if (spec) specs.add(spec);
    if (level) levels.add(level);
  }
  return {
    specs: [...specs].sort((a, b) => a.localeCompare(b, "ru")),
    levels: [...levels].sort((a, b) => a.localeCompare(b, "ru")),
  };
}

export function catalogAccessForRole(role: UserRole): CatalogVisibilityRule["access"] {
  if (role === "cb_admin") return "write";
  if (role === "viewer") return "none";
  return "read";
}

export function defaultCatalogVisibilityForPersona(
  persona: PersonaCatalogSubject,
  positions: PositionRecord[],
): CatalogVisibilityRule {
  const access = catalogAccessForRole(persona.role);
  if (persona.role === "cb_admin") {
    return { specs: "*", levels: "*", access: "write" };
  }
  if (access === "none") {
    return { specs: [], levels: [], access: "none" };
  }
  const slice = catalogSliceFromPositions(positions, persona.defaultScope);
  return {
    specs: slice.specs,
    levels: slice.levels,
    access,
  };
}

export function levelCatalogOptions(bands: SalaryRangeBand[]): string[] {
  return [...new Set(bands.map((band) => band.level))].sort((a, b) => a.localeCompare(b, "ru"));
}

export function catalogFieldToMultiSelect(value: string[] | "*", options: string[]): string[] {
  if (value === "*") return [...options];
  return value.filter((item) => options.includes(item));
}

export function multiSelectToCatalogField(selected: string[], options: string[]): string[] | "*" {
  if (selected.length === 0) return [];
  const unique = [...new Set(selected)].sort((a, b) => a.localeCompare(b, "ru"));
  if (unique.length >= options.length) return "*";
  return unique;
}

export function countCatalogBands(bands: SalaryRangeBand[], rule: CatalogVisibilityRule): number {
  return bands.filter((band) => bandMatchesCatalogVisibility(band, rule)).length;
}

export function catalogRuleSummary(rule: CatalogVisibilityRule, bands: SalaryRangeBand[]): string {
  const specLabel =
    rule.specs === "*"
      ? "все специализации"
      : rule.specs.length
        ? rule.specs.join(", ")
        : "нет";
  const levelLabel =
    rule.levels === "*"
      ? "все уровни"
      : rule.levels.length
        ? rule.levels.join(", ")
        : "нет";
  const count = countCatalogBands(bands, rule);
  return `${specLabel} · ${levelLabel} (${count} строк)`;
}
