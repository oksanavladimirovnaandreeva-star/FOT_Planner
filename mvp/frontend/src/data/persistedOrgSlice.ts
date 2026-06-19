import { EMPTY_ORG_SLICE, type OrgSliceSelection } from "./orgSliceFilters";

const STORAGE_KEY = "mvp.orgSlice";

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  }
  if (typeof value === "string" && value.length > 0) return [value];
  return [];
}

/** Нормализует сохранённый срез (в т.ч. устаревший формат с department/unit/team). */
export function normalizeOrgSliceSelection(raw: unknown): OrgSliceSelection | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const departments = asStringList(record.departments ?? record.department);
  const units = asStringList(record.units ?? record.unit);
  const teams = asStringList(record.teams ?? record.team);
  if (departments.length === 0 && units.length === 0 && teams.length === 0) {
    return { ...EMPTY_ORG_SLICE };
  }
  return { departments, units, teams };
}

export function loadPersistedOrgSlice(): OrgSliceSelection | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = normalizeOrgSliceSelection(JSON.parse(raw));
    if (!parsed) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function savePersistedOrgSlice(slice: OrgSliceSelection): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(slice));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearPersistedOrgSlice(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
