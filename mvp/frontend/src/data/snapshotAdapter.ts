import type { MvpPlanSnapshot } from "./snapshotImport";
import { extractImportablePositions, inspectSnapshot, type ImportReport } from "./snapshotImport";

export const LAST_EXPORTED_SNAPSHOT_KEY = "fot_mvp_last_export_snapshot";
export const PRE_IMPORT_BACKUP_KEY = "fot_mvp_pre_import_backup";

export function validateSnapshot(
  payload: unknown,
  options?: { currentPlanVersionId?: string },
) {
  return inspectSnapshot(payload, options);
}

export function loadSnapshot(key: string): MvpPlanSnapshot | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MvpPlanSnapshot;
  } catch {
    return null;
  }
}

export function saveSnapshot(key: string, snapshot: MvpPlanSnapshot): void {
  localStorage.setItem(key, JSON.stringify(snapshot));
}

export function loadSnapshotRaw(key: string): string | null {
  return localStorage.getItem(key);
}

export { extractImportablePositions, type ImportReport };
