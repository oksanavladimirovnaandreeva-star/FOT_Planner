import type { PositionRecord } from "../types";

export type AccessFilterField = "department" | "unit" | "team" | "employeeName";
export type AccessFilterOperator = "eq" | "neq";

export type AccessFilterRule = {
  id: string;
  field: AccessFilterField;
  operator: AccessFilterOperator;
  values: string[];
};

/** Срез доступа персоны: все правила должны выполняться (И). */
export type PersonaAccessScope = {
  rules: AccessFilterRule[];
};

/** @deprecated Старый формат — мигрируется в правила «равно». */
export type RoleScopeRecord = {
  department: string;
  unit?: string;
  team?: string;
};

export const ACCESS_FILTER_FIELD_LABELS: Record<AccessFilterField, string> = {
  department: "Департамент",
  unit: "Юнит",
  team: "Команда",
  employeeName: "ФИО сотрудника",
};

export const ACCESS_FILTER_OPERATOR_LABELS: Record<AccessFilterOperator, string> = {
  eq: "равно",
  neq: "не равно",
};

let ruleIdCounter = 0;

export function nextAccessRuleId(): string {
  ruleIdCounter += 1;
  return `rule-${ruleIdCounter}`;
}

export function legacyRoleScopeToAccessScope(scope: RoleScopeRecord): PersonaAccessScope {
  const rules: AccessFilterRule[] = [];
  if (scope.department?.trim()) {
    rules.push({
      id: nextAccessRuleId(),
      field: "department",
      operator: "eq",
      values: [scope.department.trim()],
    });
  }
  if (scope.unit?.trim()) {
    rules.push({
      id: nextAccessRuleId(),
      field: "unit",
      operator: "eq",
      values: [scope.unit.trim()],
    });
  }
  if (scope.team?.trim()) {
    rules.push({
      id: nextAccessRuleId(),
      field: "team",
      operator: "eq",
      values: [scope.team.trim()],
    });
  }
  return { rules };
}

export function normalizeAccessRule(rule: AccessFilterRule): AccessFilterRule {
  const values = [...new Set(rule.values.map((value) => value.trim()).filter(Boolean))];
  return {
    id: rule.id || nextAccessRuleId(),
    field: rule.field,
    operator: rule.operator === "neq" ? "neq" : "eq",
    values,
  };
}

export function normalizeAccessScope(scope: PersonaAccessScope): PersonaAccessScope {
  return {
    rules: scope.rules.map(normalizeAccessRule).filter((rule) => rule.values.length > 0),
  };
}

export function parseStoredAccessScope(raw: unknown): PersonaAccessScope | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.rules)) {
    const rules = obj.rules
      .filter((item): item is AccessFilterRule => !!item && typeof item === "object")
      .map((item) =>
        normalizeAccessRule({
          id: typeof item.id === "string" ? item.id : nextAccessRuleId(),
          field:
            item.field === "department" ||
            item.field === "unit" ||
            item.field === "team" ||
            item.field === "employeeName"
              ? item.field
              : "department",
          operator: item.operator === "neq" ? "neq" : "eq",
          values: Array.isArray(item.values)
            ? item.values.filter((value): value is string => typeof value === "string")
            : [],
        }),
      );
    return normalizeAccessScope({ rules });
  }
  if (typeof obj.department === "string") {
    return legacyRoleScopeToAccessScope({
      department: obj.department,
      unit: typeof obj.unit === "string" ? obj.unit : undefined,
      team: typeof obj.team === "string" ? obj.team : undefined,
    });
  }
  return null;
}

export function scopeEqValues(scope: PersonaAccessScope, field: AccessFilterField): string[] {
  return [
    ...new Set(
      scope.rules.filter((rule) => rule.field === field && rule.operator === "eq").flatMap((rule) => rule.values),
    ),
  ];
}

export function scopeNeqValues(scope: PersonaAccessScope, field: AccessFilterField): string[] {
  return [
    ...new Set(
      scope.rules.filter((rule) => rule.field === field && rule.operator === "neq").flatMap((rule) => rule.values),
    ),
  ];
}

export function scopePrimaryEq(scope: PersonaAccessScope, field: AccessFilterField): string | undefined {
  return scopeEqValues(scope, field)[0];
}

function positionFieldValue(position: PositionRecord, field: AccessFilterField): string | null {
  switch (field) {
    case "department":
      return position.department?.trim() || null;
    case "unit":
      return position.unit?.trim() || null;
    case "team":
      return position.team?.trim() || null;
    case "employeeName":
      return position.employeeName?.trim() || position.seedEmployeeName?.trim() || null;
    default:
      return null;
  }
}

function valuesMatchField(fieldValue: string | null, rule: AccessFilterRule): boolean {
  const values = rule.values.map((value) => value.trim()).filter(Boolean);
  if (values.length === 0) return true;

  if (fieldValue === null || fieldValue === "") {
    if (rule.field === "employeeName") {
      return rule.operator === "neq";
    }
    return rule.operator === "neq";
  }

  const inSet = values.some(
    (value) => fieldValue.localeCompare(value, "ru", { sensitivity: "accent" }) === 0,
  );
  return rule.operator === "eq" ? inSet : !inSet;
}

export function positionMatchesAccessScope(position: PositionRecord, scope: PersonaAccessScope): boolean {
  const normalized = normalizeAccessScope(scope);
  return normalized.rules.every((rule) => valuesMatchField(positionFieldValue(position, rule.field), rule));
}

export function orgTargetMatchesAccessScope(
  target: { department: string; unit: string; team: string },
  scope: PersonaAccessScope,
): boolean {
  const orgRules = normalizeAccessScope(scope).rules.filter((rule) => rule.field !== "employeeName");
  if (orgRules.length === 0) return true;
  const stub = {
    department: target.department,
    unit: target.unit,
    team: target.team,
    employeeName: null,
    seedEmployeeName: null,
  } as PositionRecord;
  return orgRules.every((rule) => valuesMatchField(positionFieldValue(stub, rule.field), rule));
}

export function formatPersonaOrgBinding(scope: PersonaAccessScope | null): string | null {
  if (!scope) return null;
  const teams = scopeEqValues(scope, "team");
  if (teams.length > 0) return teams.join(", ");
  const units = scopeEqValues(scope, "unit");
  if (units.length > 0) return units.join(", ");
  const departments = scopeEqValues(scope, "department");
  if (departments.length > 0) return departments.join(", ");
  return null;
}

/** Краткая строка для списка входа: «ФИО — роль». */
export function formatPersonaLoginOption(displayName: string, roleLabel: string): string {
  return `${displayName} — ${roleLabel}`;
}

export function formatAccessScopeBrief(scope: PersonaAccessScope | null): string {
  if (!scope || scope.rules.length === 0) return "Вся оргструктура";
  const parts = scope.rules.map((rule) => {
    const field = ACCESS_FILTER_FIELD_LABELS[rule.field];
    const op = ACCESS_FILTER_OPERATOR_LABELS[rule.operator];
    const values = rule.values.join(", ");
    return `${field} ${op} ${values}`;
  });
  return parts.join(" · ");
}

export function buildAccessScope(input: {
  department?: string | string[];
  unit?: string | string[];
  team?: string | string[];
  excludeEmployeeNames?: string[];
}): PersonaAccessScope {
  const rules: AccessFilterRule[] = [];
  const pushEq = (field: AccessFilterField, raw?: string | string[]) => {
    const values = (Array.isArray(raw) ? raw : raw ? [raw] : []).map((v) => v.trim()).filter(Boolean);
    if (values.length === 0) return;
    rules.push({ id: nextAccessRuleId(), field, operator: "eq", values });
  };
  pushEq("department", input.department);
  pushEq("unit", input.unit);
  pushEq("team", input.team);
  const exclude = (input.excludeEmployeeNames ?? []).map((v) => v.trim()).filter(Boolean);
  if (exclude.length > 0) {
    rules.push({ id: nextAccessRuleId(), field: "employeeName", operator: "neq", values: exclude });
  }
  return normalizeAccessScope({ rules });
}
