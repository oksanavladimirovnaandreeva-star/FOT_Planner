import type { UserRole } from "./userAccess";
import {
  legacyRoleScopeToAccessScope,
  normalizeAccessScope,
  parseStoredAccessScope,
  type PersonaAccessScope,
  type RoleScopeRecord,
} from "./personaAccessScope";

export type { PersonaAccessScope, RoleScopeRecord } from "./personaAccessScope";
export {
  ACCESS_FILTER_FIELD_LABELS,
  ACCESS_FILTER_OPERATOR_LABELS,
  buildAccessScope,
  formatAccessScopeBrief,
  nextAccessRuleId,
  normalizeAccessScope,
  orgTargetMatchesAccessScope,
  parseStoredAccessScope,
  positionMatchesAccessScope,
  scopeEqValues,
  scopeNeqValues,
  scopePrimaryEq,
} from "./personaAccessScope";

export type ScopedRole = Exclude<UserRole, "cb_admin" | "gd" | "viewer">;

const STORAGE_KEY = "fot_mvp_demo_role_scope";

export const DEFAULT_ROLE_SCOPES: Record<ScopedRole, RoleScopeRecord> = {
  director: { department: "Engineering" },
  unit_lead: { department: "Engineering", unit: "ProductDev" },
  team_lead: { department: "Engineering", unit: "ProductDev", team: "Frontend Web" },
};

export function normalizeScope(scope: RoleScopeRecord): RoleScopeRecord {
  return {
    department: scope.department.trim(),
    unit: scope.unit?.trim() || undefined,
    team: scope.team?.trim() || undefined,
  };
}

export function readRoleScopes(): Record<ScopedRole, PersonaAccessScope> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        director: legacyRoleScopeToAccessScope(DEFAULT_ROLE_SCOPES.director),
        unit_lead: legacyRoleScopeToAccessScope(DEFAULT_ROLE_SCOPES.unit_lead),
        team_lead: legacyRoleScopeToAccessScope(DEFAULT_ROLE_SCOPES.team_lead),
      };
    }
    const parsed = JSON.parse(raw) as Partial<Record<ScopedRole, unknown>>;
    const resolve = (role: ScopedRole): PersonaAccessScope => {
      const stored = parseStoredAccessScope(parsed[role]);
      if (stored) return stored;
      return legacyRoleScopeToAccessScope(DEFAULT_ROLE_SCOPES[role]);
    };
    return {
      director: resolve("director"),
      unit_lead: resolve("unit_lead"),
      team_lead: resolve("team_lead"),
    };
  } catch {
    return {
      director: legacyRoleScopeToAccessScope(DEFAULT_ROLE_SCOPES.director),
      unit_lead: legacyRoleScopeToAccessScope(DEFAULT_ROLE_SCOPES.unit_lead),
      team_lead: legacyRoleScopeToAccessScope(DEFAULT_ROLE_SCOPES.team_lead),
    };
  }
}

export function writeRoleScopes(scopes: Record<ScopedRole, PersonaAccessScope>): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      director: normalizeAccessScope(scopes.director),
      unit_lead: normalizeAccessScope(scopes.unit_lead),
      team_lead: normalizeAccessScope(scopes.team_lead),
    }),
  );
}

export function roleScopeFor(role: ScopedRole): PersonaAccessScope {
  return readRoleScopes()[role];
}
