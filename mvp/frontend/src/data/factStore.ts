import type { PositionRecord } from "../types";
import type { ViewMode } from "./dashboardMetrics";

export type EmployeeFactSlice = {
  monthlyFactBase: number[];
  monthlyFactBonus: number[];
};

const FACT_BY_EMPLOYEE_KEY = "fot_mvp_fact_by_employee";
const LEGACY_FACT_BY_POSITION_KEY = "fot_mvp_fact_by_position";

function emptySlice(): EmployeeFactSlice {
  return {
    monthlyFactBase: Array.from({ length: 12 }, () => 0),
    monthlyFactBonus: Array.from({ length: 12 }, () => 0),
  };
}

function readEmployeeStore(): Record<string, EmployeeFactSlice> {
  try {
    const raw = localStorage.getItem(FACT_BY_EMPLOYEE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, EmployeeFactSlice>;
  } catch {
    return {};
  }
}

function writeEmployeeStore(store: Record<string, EmployeeFactSlice>): void {
  localStorage.setItem(FACT_BY_EMPLOYEE_KEY, JSON.stringify(store));
}

function isValidSlice(slice: unknown): slice is EmployeeFactSlice {
  if (!slice || typeof slice !== "object") return false;
  const candidate = slice as EmployeeFactSlice;
  return (
    Array.isArray(candidate.monthlyFactBase) &&
    candidate.monthlyFactBase.length === 12 &&
    Array.isArray(candidate.monthlyFactBonus) &&
    candidate.monthlyFactBonus.length === 12
  );
}

export function getEmployeeFact(employeeId: string): EmployeeFactSlice | null {
  const slice = readEmployeeStore()[employeeId];
  return isValidSlice(slice) ? slice : null;
}

export function hasFactData(): boolean {
  return Object.keys(readEmployeeStore()).length > 0;
}

export function clearFactStore(): void {
  localStorage.removeItem(FACT_BY_EMPLOYEE_KEY);
  localStorage.removeItem(LEGACY_FACT_BY_POSITION_KEY);
}

export type FactStoreStats = {
  employeeCount: number;
  monthsWithAnyAmount: number;
};

export function factStoreStats(): FactStoreStats {
  const store = readEmployeeStore();
  const months = new Set<number>();
  for (const slice of Object.values(store)) {
    if (!isValidSlice(slice)) continue;
    for (let month = 0; month < 12; month += 1) {
      if ((slice.monthlyFactBase[month] ?? 0) !== 0 || (slice.monthlyFactBonus[month] ?? 0) !== 0) {
        months.add(month);
      }
    }
  }
  return { employeeCount: Object.keys(store).length, monthsWithAnyAmount: months.size };
}

export type FactImportMode = "replace" | "merge";

export function importEmployeeFacts(
  incoming: Record<string, EmployeeFactSlice>,
  mode: FactImportMode,
): { importedEmployees: number; mergedEmployees: number } {
  const next = mode === "replace" ? {} : { ...readEmployeeStore() };
  let mergedEmployees = 0;
  for (const [employeeId, slice] of Object.entries(incoming)) {
    if (!isValidSlice(slice)) continue;
    if (next[employeeId]) mergedEmployees += 1;
    next[employeeId] = {
      monthlyFactBase: [...slice.monthlyFactBase],
      monthlyFactBonus: [...slice.monthlyFactBonus],
    };
  }
  writeEmployeeStore(next);
  return { importedEmployees: Object.keys(incoming).length, mergedEmployees };
}

export function monthFactAmountForPosition(
  position: PositionRecord,
  month: number,
  viewMode: ViewMode,
): number {
  if (position.status === "Closed" || month < position.activeFromMonth) return 0;
  if (!position.employeeId) return 0;
  const slice = getEmployeeFact(position.employeeId);
  if (!slice) return 0;
  const base = slice.monthlyFactBase[month] ?? 0;
  const bonus = slice.monthlyFactBonus[month] ?? 0;
  return viewMode === "total" ? base + bonus : base;
}

/** @deprecated Используйте monthFactAmountForPosition */
export function monthFactAmountFromStore(
  position: PositionRecord,
  month: number,
  viewMode: ViewMode,
): number {
  return monthFactAmountForPosition(position, month, viewMode);
}

/** Демо: факт = 95% плана — только для проверки UI, не prod. */
export function seedDemoFactFromPlan(positions: PositionRecord[]): number {
  const store: Record<string, EmployeeFactSlice> = {};
  for (const position of positions) {
    if (position.status === "Closed" || !position.employeeId) continue;
    store[position.employeeId] = {
      monthlyFactBase: position.monthlyBase.map((value, index) =>
        index < position.activeFromMonth ? 0 : Math.round(value * 0.95),
      ),
      monthlyFactBonus: position.monthlyBonus.map((value, index) =>
        index < position.activeFromMonth ? 0 : Math.round(value * 0.95),
      ),
    };
  }
  writeEmployeeStore(store);
  return Object.keys(store).length;
}

/** Миграция старого хранилища по positionId → employeeId (если есть сотрудник на позиции). */
export function migrateLegacyFactByPosition(positions: PositionRecord[]): number {
  if (Object.keys(readEmployeeStore()).length > 0) return 0;
  try {
    const raw = localStorage.getItem(LEGACY_FACT_BY_POSITION_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as Record<string, EmployeeFactSlice>;
    const byPosition = new Map(positions.map((position) => [position.positionId, position] as const));
    const migrated: Record<string, EmployeeFactSlice> = {};
    for (const [positionId, slice] of Object.entries(parsed)) {
      if (!isValidSlice(slice)) continue;
      const position = byPosition.get(positionId);
      if (!position?.employeeId) continue;
      migrated[position.employeeId] = slice;
    }
    if (Object.keys(migrated).length === 0) return 0;
    importEmployeeFacts(migrated, "merge");
    localStorage.removeItem(LEGACY_FACT_BY_POSITION_KEY);
    return Object.keys(migrated).length;
  } catch {
    return 0;
  }
}

export { emptySlice };
