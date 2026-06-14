import type { OrgSliceSelection } from "./orgSliceFilters";

const STORAGE_KEY = "mvp.orgSlice";

export function loadPersistedOrgSlice(): OrgSliceSelection | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OrgSliceSelection;
  } catch {
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
