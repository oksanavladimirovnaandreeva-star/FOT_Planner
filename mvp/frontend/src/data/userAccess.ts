import { roleScopeFor } from "./demoRoleScopeStore";
import { activePersonaScopeForRole } from "./demoSessionStore";
import {
  DEMO_UNIT_A_TEAMS_LIST,
  resolvePlanningTeamsForActivePersona,
} from "./demoPersonas";
import {
  formatAccessScopeBrief,
  positionMatchesAccessScope,
  scopeEqValues,
  scopePrimaryEq,
  type PersonaAccessScope,
} from "./personaAccessScope";
import type { PositionRecord } from "../types";

/**
 * MVP: демо RBAC + фиксированный org-scope (DEMO_ROLE_SCOPE).
 * Прод (ИБ): роль + атрибуты среза на бэкенде (RLS), не доверять localStorage.
 * См. docs/SECURITY-REQUIREMENTS.md
 */
export type UserRole = "cb_admin" | "gd" | "director" | "unit_lead" | "team_lead" | "viewer";

const ROLE_STORAGE_KEY = "fot_mvp_user_role";
const FREEZE_STORAGE_KEY = "fot_mvp_lead_edit_frozen";

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  cb_admin: "C&B (администратор)",
  gd: "Генеральный директор",
  director: "Директор (департамент)",
  unit_lead: "Юнит-лид (юнит)",
  team_lead: "Тимлид (команда)",
  viewer: "Финменеджер (просмотр)",
};

/** Краткие подписи ролей на экране входа. */
export const LOGIN_ROLE_LABELS: Record<UserRole, string> = {
  cb_admin: "C&B",
  gd: "Генеральный директор",
  director: "Директор",
  unit_lead: "Юнит-лид",
  team_lead: "Тимлид",
  viewer: "Просмотр",
};

/** Демо-срез для роли — активная персона или пресет из Настроек → Доступы. */
export function demoRoleScope(role: Exclude<UserRole, "cb_admin" | "gd" | "viewer">): PersonaAccessScope {
  const personaScope = activePersonaScopeForRole(role);
  if (personaScope) return personaScope;
  return roleScopeFor(role);
}

export function demoRoleActorOrg(role: Exclude<UserRole, "cb_admin" | "gd" | "viewer">): {
  departments: string[];
  units: string[];
  teams: string[];
} {
  const scope = demoRoleScope(role);
  return {
    departments: scopeEqValues(scope, "department"),
    units: scopeEqValues(scope, "unit"),
    teams: scopeEqValues(scope, "team"),
  };
}

export function demoRolePrimaryOrg(role: Exclude<UserRole, "cb_admin" | "gd" | "viewer">): {
  department: string;
  unit: string | null;
  team: string | null;
} {
  const scope = demoRoleScope(role);
  return {
    department: scopePrimaryEq(scope, "department") ?? "",
    unit: scopePrimaryEq(scope, "unit") ?? null,
    team: scopePrimaryEq(scope, "team") ?? null,
  };
}

/** @deprecated Используйте demoRoleScope(role) и scopePrimaryEq. */
export const DEMO_ROLE_SCOPE = {
  get director() {
    const scope = demoRoleScope("director");
    return {
      department: scopePrimaryEq(scope, "department") ?? "Engineering",
      unit: scopePrimaryEq(scope, "unit"),
      team: scopePrimaryEq(scope, "team"),
    };
  },
  get unit_lead() {
    const scope = demoRoleScope("unit_lead");
    return {
      department: scopePrimaryEq(scope, "department") ?? "Engineering",
      unit: scopePrimaryEq(scope, "unit") ?? "ProductDev",
      team: scopePrimaryEq(scope, "team"),
    };
  },
  get team_lead() {
    const scope = demoRoleScope("team_lead");
    return {
      department: scopePrimaryEq(scope, "department") ?? "Engineering",
      unit: scopePrimaryEq(scope, "unit") ?? "ProductDev",
      team: scopePrimaryEq(scope, "team") ?? "Frontend Web",
    };
  },
};

export type OrgFilterDefaults = {
  departments: string[];
  units: string[];
  teams: string[];
  lockDepartment: boolean;
  lockUnit: boolean;
  lockTeam: boolean;
  /** Команды по умолчанию (прямые тимлиды unit_lead). */
  defaultTeams?: string[];
  /** Все команды, доступные в мультиселекте. */
  maxTeams?: string[];
  showAllTeamsToggle?: boolean;
};

export function loadUserRole(): UserRole {
  try {
    const stored = localStorage.getItem(ROLE_STORAGE_KEY);
    if (stored === "admin") {
      localStorage.setItem(ROLE_STORAGE_KEY, "cb_admin");
      return "cb_admin";
    }
    if (
      stored === "cb_admin" ||
      stored === "gd" ||
      stored === "director" ||
      stored === "unit_lead" ||
      stored === "team_lead" ||
      stored === "viewer"
    ) {
      return stored;
    }
  } catch {
    /* ignore */
  }
  return "cb_admin";
}

export function saveUserRole(role: UserRole): void {
  localStorage.setItem(ROLE_STORAGE_KEY, role);
}

export function loadLeadEditFrozen(): boolean {
  try {
    return localStorage.getItem(FREEZE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveLeadEditFrozen(frozen: boolean): void {
  localStorage.setItem(FREEZE_STORAGE_KEY, frozen ? "1" : "0");
}

export function roleIsCbAdmin(role: UserRole): boolean {
  return role === "cb_admin";
}

export function roleCanToggleLeadFreeze(role: UserRole): boolean {
  return role === "cb_admin" || role === "gd" || role === "director";
}

export type SettingsAccess = "full" | "stub";

/** Полный доступ к настройкам — только C&B (данные, пилот, оргструктура). */
export function roleSettingsAccess(role: UserRole): SettingsAccess {
  return role === "cb_admin" ? "full" : "stub";
}

/** Пункт «Настройки» в навигации — только C&B. */
export function roleSettingsNavVisible(role: UserRole): boolean {
  return role === "cb_admin";
}

/** Жизненный цикл версий, импорт факта, админ-операции — только C&B. */
export function roleCanManageVersions(role: UserRole): boolean {
  return role === "cb_admin";
}

export function roleCanImportFact(role: UserRole): boolean {
  return role === "cb_admin";
}

export function roleCanImportPlan(role: UserRole): boolean {
  return role === "cb_admin";
}

export function roleCanEditSalaryCatalog(role: UserRole): boolean {
  return role === "cb_admin";
}

/** Пункт «Версии» / «Мой бюджет» в навигации. */
export function roleVersionsNavLabel(role: UserRole): string {
  return roleCanManageVersions(role) ? "Версии" : "Мой бюджет";
}

/** Переключатель всех версий в сайдбаре — только C&B. */
export function roleCanSwitchPlanVersions(role: UserRole): boolean {
  return role === "cb_admin";
}

/** Массовая индексация — только C&B (PRODUCT-MODEL §3, §5). */
export function roleCanApplyMassIndexation(role: UserRole): boolean {
  return role === "cb_admin";
}

/** Выгрузка заявок Kaiten (демо UI) — все роли кроме viewer. */
export function roleCanExportKaiten(role: UserRole): boolean {
  return role !== "viewer";
}

/** Kaiten UI: экспорт + nudge — не viewer и не freeze лидов. */
export function canShowKaitenExport(role: UserRole, leadEditFrozen: boolean): boolean {
  return roleCanExportKaiten(role) && roleCanEdit(role, leadEditFrozen);
}

/**
 * Правки плана по роли. Директор может «закрыть» правки тимлидов и юнит-лидов (freeze).
 */
export function roleCanEdit(role: UserRole, leadFrozen: boolean): boolean {
  if (role === "viewer") return false;
  if (leadFrozen && (role === "team_lead" || role === "unit_lead")) return false;
  return true;
}

/** Краткая строка org-среза для UI (сайдбар, заголовки). */
export function formatDemoRoleScope(role: UserRole): string | null {
  switch (role) {
    case "cb_admin":
      return "Вся оргструктура";
    case "viewer":
      return "Просмотр по всей компании";
    case "gd":
      return "Вся оргструктура (компания)";
    case "director": {
      const scope = demoRoleScope("director");
      return formatAccessScopeBrief(scope);
    }
    case "unit_lead": {
      const scope = demoRoleScope("unit_lead");
      return formatAccessScopeBrief(scope);
    }
    case "team_lead": {
      const scope = demoRoleScope("team_lead");
      return formatAccessScopeBrief(scope);
    }
    default:
      return null;
  }
}

export function roleScopeDescription(role: UserRole, leadFrozen: boolean): string {
  const freezeNote =
    leadFrozen && (role === "team_lead" || role === "unit_lead")
      ? " Правки закрыты директором."
      : leadFrozen && roleCanToggleLeadFreeze(role)
        ? " Правки тимлидов и юнит-лидов закрыты."
        : "";
  switch (role) {
    case "cb_admin":
      return "Видны все позиции. Полный доступ: версии, факт, справочники." + freezeNote;
    case "gd":
      return "Видны все позиции. Права директора по компании: редактирование и freeze лидов." + freezeNote;
    case "viewer":
      return "Только просмотр и аудит по всей оргструктуре, без правок.";
    case "director": {
      const scope = demoRoleScope("director");
      return `Срез: ${formatAccessScopeBrief(scope)}. Можно править план и закрыть правки лидов.${freezeNote}`;
    }
    case "unit_lead": {
      const scope = demoRoleScope("unit_lead");
      return `Срез: ${formatAccessScopeBrief(scope)}.${freezeNote}`;
    }
    case "team_lead": {
      const scope = demoRoleScope("team_lead");
      return `Срез: ${formatAccessScopeBrief(scope)}.${freezeNote}`;
    }
    default:
      return "";
  }
}

export function positionMatchesRole(position: PositionRecord, role: UserRole): boolean {
  if (role === "cb_admin" || role === "gd" || role === "viewer") return true;
  return positionMatchesAccessScope(position, demoRoleScope(role));
}

export function filterPositionsByRole(positions: PositionRecord[], role: UserRole): PositionRecord[] {
  if (role === "cb_admin" || role === "gd" || role === "viewer") return positions;
  return positions.filter((position) => positionMatchesRole(position, role));
}

/** Фиксированные фильтры оргструктуры для team_lead и unit_lead. */
export function roleOrgFilterDefaults(role: UserRole): OrgFilterDefaults | null {
  if (role === "team_lead") {
    const scope = demoRoleScope("team_lead");
    const departments = scopeEqValues(scope, "department");
    const units = scopeEqValues(scope, "unit");
    const teams = scopeEqValues(scope, "team");
    return {
      departments,
      units,
      teams,
      lockDepartment: departments.length > 0,
      lockUnit: units.length > 0,
      lockTeam: teams.length > 0,
    };
  }
  if (role === "unit_lead") {
    const scope = demoRoleScope("unit_lead");
    const departments = scopeEqValues(scope, "department");
    const units = scopeEqValues(scope, "unit");
    const defaultTeams = resolvePlanningTeamsForActivePersona();
    const maxTeams = [...DEMO_UNIT_A_TEAMS_LIST];
    return {
      departments,
      units,
      teams: defaultTeams.length > 0 ? defaultTeams : maxTeams,
      defaultTeams,
      maxTeams,
      showAllTeamsToggle: true,
      lockDepartment: departments.length > 0,
      lockUnit: units.length > 0,
      lockTeam: false,
    };
  }
  return null;
}

/** Применяет правки только в рамках видимого среза, остальные позиции не трогает. */
export function mergeScopedPositionUpdates(
  allPositions: PositionRecord[],
  previousScoped: PositionRecord[],
  nextScoped: PositionRecord[],
): PositionRecord[] {
  const patch = new Map(nextScoped.map((position) => [position.positionId, position]));
  const previousScopedIds = new Set(previousScoped.map((position) => position.positionId));
  const nextScopedIds = new Set(nextScoped.map((position) => position.positionId));
  const removedIds = new Set(
    [...previousScopedIds].filter((positionId) => !nextScopedIds.has(positionId)),
  );

  const merged = allPositions
    .filter((position) => !removedIds.has(position.positionId))
    .map((position) => patch.get(position.positionId) ?? position);

  const added = nextScoped.filter((position) => !allPositions.some((item) => item.positionId === position.positionId));
  for (const position of added) {
    if (!merged.some((item) => item.positionId === position.positionId)) {
      merged.push(position);
    }
  }
  return merged;
}
