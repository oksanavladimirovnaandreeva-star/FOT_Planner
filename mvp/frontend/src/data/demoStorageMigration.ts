import type { PositionRecord } from "../types";
import { DEFAULT_ROLE_SCOPES, writeRoleScopes } from "./demoRoleScopeStore";
import { legacyRoleScopeToAccessScope } from "./personaAccessScope";
import { clearPersistedOrgSlice } from "./persistedOrgSlice";

const LEGACY_ORG_MARKERS = [
  "Engineering",
  "ProductDev",
  "Frontend Web",
  "HR Department",
  "Sales Department",
] as const;

const STALE_DEMO_KEYS = [
  "fot_mvp_demo_role_scope",
  "fot_mvp_demo_persona_scopes",
  "fot_mvp_org_tree",
  "mvp.packageSubmissions",
  "mvp.teamSubmissions",
] as const;

export function positionsUseLegacyOrg(positions: PositionRecord[]): boolean {
  for (const position of positions) {
    const haystack = `${position.department}\0${position.unit}\0${position.team}`;
    for (const marker of LEGACY_ORG_MARKERS) {
      if (haystack.includes(marker)) return true;
    }
  }
  return false;
}

/** Сбрасывает устаревшие срезы/оргструктуру в браузере после смены демо-сидa. */
export function resetStaleDemoOrgCaches(): void {
  for (const key of STALE_DEMO_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  clearPersistedOrgSlice();
  writeRoleScopes({
    director: legacyRoleScopeToAccessScope(DEFAULT_ROLE_SCOPES.director),
    unit_lead: legacyRoleScopeToAccessScope(DEFAULT_ROLE_SCOPES.unit_lead),
    team_lead: legacyRoleScopeToAccessScope(DEFAULT_ROLE_SCOPES.team_lead),
  });
}
