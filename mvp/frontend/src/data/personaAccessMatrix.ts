import {
  buildAccessScope,
  positionMatchesAccessScope,
  scopeEqValues,
  type PersonaAccessScope,
} from "./personaAccessScope";
import { departmentOptions, teamOptions, unitOptions } from "./orgStructure";
import type { PositionRecord } from "../types";

/** Плоское представление орг-среза для таблицы настроек. */
export type PersonaOrgMatrixRow = {
  departments: string[];
  units: string[];
  teams: string[];
  excludeSelf: boolean;
};

export function scopeFromOrgMatrixRow(
  row: PersonaOrgMatrixRow,
  selfEmployeeName?: string,
): PersonaAccessScope {
  const exclude: string[] = [];
  if (row.excludeSelf && selfEmployeeName?.trim()) {
    exclude.push(selfEmployeeName.trim());
  }
  return buildAccessScope({
    department: row.departments,
    unit: row.units,
    team: row.teams,
    excludeEmployeeNames: exclude,
  });
}

export function orgMatrixRowFromScope(
  scope: PersonaAccessScope,
  selfEmployeeName?: string,
): PersonaOrgMatrixRow {
  return {
    departments: scopeEqValues(scope, "department"),
    units: scopeEqValues(scope, "unit"),
    teams: scopeEqValues(scope, "team"),
    excludeSelf: Boolean(
      selfEmployeeName &&
        scope.rules.some(
          (rule) =>
            rule.field === "employeeName" &&
            rule.operator === "neq" &&
            rule.values.some(
              (value) =>
                value.localeCompare(selfEmployeeName, "ru", { sensitivity: "accent" }) === 0,
            ),
        ),
    ),
  };
}

/** Срез задаётся только eq по оргполям + опционально neq своего ФИО. */
export function isSimpleOrgScope(scope: PersonaAccessScope, selfEmployeeName?: string): boolean {
  const normalized = scope.rules.filter((rule) => rule.values.length > 0);
  for (const rule of normalized) {
    if (rule.field === "employeeName") {
      if (rule.operator !== "neq") return false;
      if (!selfEmployeeName) return false;
      const onlySelf =
        rule.values.length === 1 &&
        rule.values[0].localeCompare(selfEmployeeName, "ru", { sensitivity: "accent" }) === 0;
      if (!onlySelf) return false;
      continue;
    }
    if (!["department", "unit", "team"].includes(rule.field)) return false;
    if (rule.operator !== "eq") return false;
  }
  return true;
}

export function countPositionsForScope(
  positions: PositionRecord[],
  scope: PersonaAccessScope | null,
): number {
  if (!scope || scope.rules.length === 0) return positions.filter((p) => p.status !== "Closed").length;
  return positions.filter(
    (position) => position.status !== "Closed" && positionMatchesAccessScope(position, scope),
  ).length;
}

export function unitOptionsForMatrix(row: PersonaOrgMatrixRow): string[] {
  const depts = row.departments.length > 0 ? row.departments : departmentOptions();
  const result = new Set<string>();
  for (const dept of depts) {
    for (const unit of unitOptions(dept)) result.add(unit);
  }
  return [...result].sort((a, b) => a.localeCompare(b, "ru"));
}

export function teamOptionsForMatrix(row: PersonaOrgMatrixRow): string[] {
  const depts = row.departments.length > 0 ? row.departments : departmentOptions();
  const units = row.units.length > 0 ? row.units : [];
  const result = new Set<string>();
  if (units.length > 0) {
    for (const dept of depts) {
      for (const unit of units) {
        for (const team of teamOptions(dept, unit)) result.add(team);
      }
    }
  } else {
    for (const dept of depts) {
      for (const unit of unitOptions(dept)) {
        for (const team of teamOptions(dept, unit)) result.add(team);
      }
    }
  }
  return [...result].sort((a, b) => a.localeCompare(b, "ru"));
}

export function formatOrgMatrixBrief(row: PersonaOrgMatrixRow): string {
  const parts: string[] = [];
  if (row.departments.length) parts.push(row.departments.join(", "));
  if (row.units.length) parts.push(row.units.join(", "));
  if (row.teams.length) parts.push(row.teams.join(", "));
  if (parts.length === 0) return "Вся оргструктура";
  if (row.excludeSelf) parts.push("без себя");
  return parts.join(" · ");
}
