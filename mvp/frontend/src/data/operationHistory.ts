import type { MvpPlanSnapshot } from "./snapshotImport";
import { PRE_IMPORT_BACKUP_KEY, saveSnapshot } from "./snapshotAdapter";

export const OPERATION_HISTORY_KEY = "fot_mvp_operation_history";
const MAX_HISTORY = 5;

export type OperationKind = "import_replace" | "import_merge" | "rollback_export" | "rollback_pre_import" | "rollback_point";

export type OperationLogEntry = {
  id: string;
  at: string;
  kind: OperationKind;
  label: string;
  summary: string;
  /** Снимок для отката к этой точке (состояние до операции или после — см. kind). */
  snapshot: MvpPlanSnapshot;
};

function readHistory(): OperationLogEntry[] {
  try {
    const raw = localStorage.getItem(OPERATION_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is OperationLogEntry => {
      return (
        item &&
        typeof item === "object" &&
        typeof (item as OperationLogEntry).id === "string" &&
        typeof (item as OperationLogEntry).snapshot === "object"
      );
    });
  } catch {
    return [];
  }
}

function writeHistory(entries: OperationLogEntry[]): void {
  localStorage.setItem(OPERATION_HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
}

export function listOperationHistory(): OperationLogEntry[] {
  return readHistory();
}

export function appendOperationHistory(entry: Omit<OperationLogEntry, "id" | "at">): void {
  const next: OperationLogEntry = {
    ...entry,
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
  };
  writeHistory([next, ...readHistory()]);
}

/** Сохранить снимок «до импорта» в историю (точка отката = состояние до операции). */
export function recordPreImportPoint(snapshot: MvpPlanSnapshot, mode: "replace" | "merge"): void {
  appendOperationHistory({
    kind: mode === "replace" ? "import_replace" : "import_merge",
    label: mode === "replace" ? "Импорт (перезапись)" : "Импорт (merge)",
    summary: `Точка до импорта · ${snapshot.positions.length} поз.`,
    snapshot,
  });
  saveSnapshot(PRE_IMPORT_BACKUP_KEY, snapshot);
}

export function recordRollbackExport(snapshot: MvpPlanSnapshot): void {
  appendOperationHistory({
    kind: "rollback_export",
    label: "Откат к экспорту",
    summary: `Восстановлено ${snapshot.positions.length} поз.`,
    snapshot,
  });
}

export function recordRollbackPreImport(snapshot: MvpPlanSnapshot): void {
  appendOperationHistory({
    kind: "rollback_pre_import",
    label: "Откат до импорта",
    summary: `Восстановлено ${snapshot.positions.length} поз.`,
    snapshot,
  });
}

export function recordManualRestorePoint(snapshot: MvpPlanSnapshot, label: string): void {
  appendOperationHistory({
    kind: "rollback_point",
    label,
    summary: `${snapshot.positions.length} поз.`,
    snapshot,
  });
}
