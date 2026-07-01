import { DEMO_SEED_VERSION_KEY } from "./demoPlanSeed";
import { clearFactStore } from "./factStore";
import { PILOT_BUNDLE_KEY } from "./pilotTestBundle";
import { resetWorkflowHints } from "./workflowHints";

/** Ключ с планом по версиям — главный источник подвисаний (мегабайты JSON). */
export const MVP_PLAN_DATA_KEY = "fot_mvp_plan_data_by_version";
export const MVP_PLAN_VERSIONS_KEY = "fot_mvp_plan_versions_meta";

const PILOT_AND_PLAN_KEYS = [
  MVP_PLAN_DATA_KEY,
  MVP_PLAN_VERSIONS_KEY,
  PILOT_BUNDLE_KEY,
  DEMO_SEED_VERSION_KEY,
  "fot_mvp_plan_version",
  "mvp.teamSubmissions",
  "mvp.packageSubmissions",
  "fot_mvp_org_tree",
  "fot_mvp_org_history",
  "fot_mvp_demo_persona_id",
  "fot_mvp_demo_persona_scopes",
  "fot_mvp_demo_persona_catalog_access",
  "fot_mvp_demo_persona_catalog_visibility",
  "fot_mvp_band_access_grants",
  "fot_mvp_demo_role_scope",
  "fot_mvp_last_export_snapshot",
  "fot_mvp_pre_import_backup",
  "fot_mvp_operation_history",
  "mvp.exportAudit",
  "mvp.hint.dashboard-fact",
  "mvp.hint.planning-lead",
] as const;

const PREFERENCE_KEYS = [
  "fot_mvp_user_role",
  "fot_mvp_view_mode",
  "fot_mvp_catalog_access",
  "fot_mvp_lead_edit_frozen",
] as const;

function removeKeys(keys: readonly string[]): void {
  for (const key of keys) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

/** Удаляет пилотный/демо-план, факт и связанные ключи. Настройки роли не трогает. */
export function clearPilotDemoStorage(): void {
  removeKeys(PILOT_AND_PLAN_KEYS);
  clearFactStore();
  resetWorkflowHints();
  try {
    sessionStorage.removeItem("mvp.orgSlice");
  } catch {
    /* ignore */
  }
}

/** Полный сброс MVP в браузере (включая роль и режим просмотра). */
export function clearAllMvpStorage(): void {
  clearPilotDemoStorage();
  removeKeys(PREFERENCE_KEYS);
}

/**
 * ?reset=demo | ?reset=pilot — сброс пилота/плана до монтирования React.
 * ?reset=all — полный сброс localStorage MVP.
 */
export function applyEmergencyStorageResetFromUrl(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("reset");
    if (mode !== "demo" && mode !== "pilot" && mode !== "all") return false;

    if (mode === "all") clearAllMvpStorage();
    else clearPilotDemoStorage();

    params.delete("reset");
    const qs = params.toString();
    const next = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", next);
    return true;
  } catch {
    return false;
  }
}
