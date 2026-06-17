import type { UserRole } from "./userAccess";

export type ScopedRole = Exclude<UserRole, "cb_admin" | "gd" | "viewer">;

export type RoleScopeRecord = {
  department: string;
  unit?: string;
  team?: string;
};

const STORAGE_KEY = "fot_mvp_demo_role_scope";

export const DEFAULT_ROLE_SCOPES: Record<ScopedRole, RoleScopeRecord> = {
  director: { department: "Engineering" },
  unit_lead: { department: "Engineering", unit: "ProductDev" },
  team_lead: { department: "Engineering", unit: "ProductDev", team: "Frontend Web" },
};

function normalizeScope(scope: RoleScopeRecord): RoleScopeRecord {
  return {
    department: scope.department.trim(),
    unit: scope.unit?.trim() || undefined,
    team: scope.team?.trim() || undefined,
  };
}

export function readRoleScopes(): Record<ScopedRole, RoleScopeRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ROLE_SCOPES };
    const parsed = JSON.parse(raw) as Partial<Record<ScopedRole, RoleScopeRecord>>;
    return {
      director: normalizeScope(parsed.director ?? DEFAULT_ROLE_SCOPES.director),
      unit_lead: normalizeScope(parsed.unit_lead ?? DEFAULT_ROLE_SCOPES.unit_lead),
      team_lead: normalizeScope(parsed.team_lead ?? DEFAULT_ROLE_SCOPES.team_lead),
    };
  } catch {
    return { ...DEFAULT_ROLE_SCOPES };
  }
}

export function writeRoleScopes(scopes: Record<ScopedRole, RoleScopeRecord>): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      director: normalizeScope(scopes.director),
      unit_lead: normalizeScope(scopes.unit_lead),
      team_lead: normalizeScope(scopes.team_lead),
    }),
  );
}

export function roleScopeFor(role: ScopedRole): RoleScopeRecord {
  return readRoleScopes()[role];
}
