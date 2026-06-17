import { roleScopeFor, type RoleScopeRecord } from "./demoRoleScopeStore";
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

/** Демо-срез для ролей — читается из localStorage (Настройки → Доступы). */
export function demoRoleScope(role: Exclude<UserRole, "cb_admin" | "gd" | "viewer">): RoleScopeRecord {
  return roleScopeFor(role);
}

/** @deprecated Используйте demoRoleScope(role). */
export const DEMO_ROLE_SCOPE = {
  get director() {
    return demoRoleScope("director");
  },
  get unit_lead() {
    return demoRoleScope("unit_lead");
  },
  get team_lead() {
    return demoRoleScope("team_lead");
  },
};

export type OrgFilterDefaults = {
  departments: string[];
  units: string[];
  teams: string[];
  lockDepartment: boolean;
  lockUnit: boolean;
  lockTeam: boolean;
};

export function loadUserRole(): UserRole {
  try {
    const stored = localStorage.getItem(ROLE_STORAGE_KEY);
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
    if (stored === "admin") return "cb_admin";
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

/** Полный доступ к настройкам — C&B и директор; остальные видят заглушку. */
export function roleSettingsAccess(role: UserRole): SettingsAccess {
  return role === "cb_admin" || role === "gd" || role === "director" ? "full" : "stub";
}

/** Пункт «Настройки» в навигации — только C&B и директор. */
export function roleSettingsNavVisible(role: UserRole): boolean {
  return role === "cb_admin" || role === "gd" || role === "director";
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
      return `Департамент: ${scope.department}`;
    }
    case "unit_lead": {
      const scope = demoRoleScope("unit_lead");
      return `Юнит: ${scope.department} / ${scope.unit}`;
    }
    case "team_lead": {
      const scope = demoRoleScope("team_lead");
      return `Команда: ${scope.department} / ${scope.unit} / ${scope.team}`;
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
      return `Срез: департамент ${scope.department} (все юниты). Можно закрыть правки лидов.${freezeNote}`;
    }
    case "unit_lead": {
      const scope = demoRoleScope("unit_lead");
      return `Срез: юнит ${scope.department} / ${scope.unit} (все команды юнита).${freezeNote}`;
    }
    case "team_lead": {
      const scope = demoRoleScope("team_lead");
      return `Срез: команда ${scope.department} / ${scope.unit} / ${scope.team}.${freezeNote}`;
    }
    default:
      return "";
  }
}

export function positionMatchesRole(position: PositionRecord, role: UserRole): boolean {
  if (role === "cb_admin" || role === "gd" || role === "viewer") return true;
  if (role === "director") {
    return position.department === demoRoleScope("director").department;
  }
  if (role === "unit_lead") {
    const scope = demoRoleScope("unit_lead");
    return position.department === scope.department && position.unit === scope.unit;
  }
  const scope = demoRoleScope("team_lead");
  return (
    position.department === scope.department &&
    position.unit === scope.unit &&
    position.team === scope.team
  );
}

export function filterPositionsByRole(positions: PositionRecord[], role: UserRole): PositionRecord[] {
  if (role === "cb_admin" || role === "gd" || role === "viewer") return positions;
  return positions.filter((position) => positionMatchesRole(position, role));
}

/** Фиксированные фильтры оргструктуры для team_lead и unit_lead. */
export function roleOrgFilterDefaults(role: UserRole): OrgFilterDefaults | null {
  if (role === "team_lead") {
    const scope = demoRoleScope("team_lead");
    return {
      departments: [scope.department],
      units: scope.unit ? [scope.unit] : [],
      teams: scope.team ? [scope.team] : [],
      lockDepartment: true,
      lockUnit: true,
      lockTeam: true,
    };
  }
  if (role === "unit_lead") {
    const scope = demoRoleScope("unit_lead");
    return {
      departments: [scope.department],
      units: scope.unit ? [scope.unit] : [],
      teams: [],
      lockDepartment: true,
      lockUnit: true,
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
  const previousIds = new Set(previousScoped.map((position) => position.positionId));
  const added = nextScoped.filter((position) => !allPositions.some((item) => item.positionId === position.positionId));
  const merged = allPositions.map((position) => patch.get(position.positionId) ?? position);
  for (const position of added) {
    if (!merged.some((item) => item.positionId === position.positionId)) {
      merged.push(position);
    }
  }
  void previousIds;
  return merged;
}
