import type { UserRole } from "./userAccess";

export type ExportAuditFormat = "plan_csv" | "fact_csv";

export type ExportAuditEntry = {
  id: string;
  at: string;
  userRole: UserRole;
  format: ExportAuditFormat;
  rowCount: number;
  scopeHash: string;
  planVersionId: string;
  scopeLabel: string;
};

const STORAGE_KEY = "mvp.exportAudit";
const MAX_ENTRIES = 50;

function readEntries(): ExportAuditEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ExportAuditEntry => {
      return (
        item &&
        typeof item === "object" &&
        typeof (item as ExportAuditEntry).id === "string" &&
        typeof (item as ExportAuditEntry).at === "string"
      );
    });
  } catch {
    return [];
  }
}

function writeEntries(entries: ExportAuditEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    /* ignore quota */
  }
}

export function listExportAuditLog(): ExportAuditEntry[] {
  return readEntries();
}

export function appendExportAuditLog(
  entry: Omit<ExportAuditEntry, "id" | "at">,
): ExportAuditEntry {
  const next: ExportAuditEntry = {
    ...entry,
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
  };
  writeEntries([next, ...readEntries()]);
  return next;
}
