import { MONTHS } from "../types";
import type { PositionRecord } from "../types";
import { pickFotAmount, type ViewMode } from "./dashboardMetrics";
import { hasFactData, monthFactAmountOnPosition } from "./factStore";
import type { OrgSliceSelection } from "./orgSliceFilters";
import { LIMIT_FLAG_LABELS, POSITION_STATUS_LABELS } from "./planningData";

const UTF8_BOM = "\uFEFF";

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function row(values: (string | number)[]): string {
  return values.map((value) => escapeCsv(String(value))).join(";");
}

export function buildOrgScopeHash(scope: OrgSliceSelection): string {
  const raw = `${scope.departments.join(",")}|${scope.units.join(",")}|${scope.teams.join(",")}`;
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = (hash * 31 + raw.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function formatOrgScopeLabel(scope: OrgSliceSelection): string {
  const parts: string[] = [];
  if (scope.departments.length) parts.push(`деп: ${scope.departments.join(", ")}`);
  if (scope.units.length) parts.push(`юнит: ${scope.units.join(", ")}`);
  if (scope.teams.length) parts.push(`команда: ${scope.teams.join(", ")}`);
  return parts.length ? parts.join(" · ") : "все срезы";
}

function monthAmount(position: PositionRecord, month: number, viewMode: ViewMode): number {
  return pickFotAmount(position.monthlyBase[month] ?? 0, position.monthlyBonus[month] ?? 0, viewMode);
}

export function buildPlanPositionsCsv(options: {
  positions: PositionRecord[];
  viewMode: ViewMode;
  planVersionId: string;
  planYear: number;
}): string {
  const { positions, viewMode, planVersionId, planYear } = options;
  const amountLabel = viewMode === "total" ? "ФОТ" : "оклад";
  const header = row([
    "plan_version_id",
    "plan_year",
    "position_id",
    "role",
    "department",
    "unit",
    "team",
    "status",
    "employee_name",
    "employee_id",
    "limit_flag",
    ...MONTHS.map((label) => `${label}_${amountLabel}`),
    `year_total_${amountLabel}`,
  ]);

  const lines = positions.map((position) => {
    const monthly = MONTHS.map((_, month) => monthAmount(position, month, viewMode));
    const yearTotal = monthly.reduce((sum, value) => sum + value, 0);
    return row([
      planVersionId,
      planYear,
      position.positionId,
      position.role,
      position.department,
      position.unit,
      position.team,
      POSITION_STATUS_LABELS[position.status],
      position.employeeName ?? "",
      position.employeeId ?? "",
      LIMIT_FLAG_LABELS[position.limitFlag],
      ...monthly,
      yearTotal,
    ]);
  });

  return UTF8_BOM + [header, ...lines].join("\r\n");
}

export function buildPlanFactCsv(options: {
  positions: PositionRecord[];
  viewMode: ViewMode;
  planVersionId: string;
  planYear: number;
}): string | null {
  if (!hasFactData()) return null;
  const { positions, viewMode, planVersionId, planYear } = options;
  const amountLabel = viewMode === "total" ? "ФОТ" : "оклад";
  const header = row([
    "plan_version_id",
    "plan_year",
    "position_id",
    "role",
    "department",
    "unit",
    "team",
    ...MONTHS.map((label) => `${label}_fact_${amountLabel}`),
    `year_total_fact_${amountLabel}`,
  ]);

  const lines = positions.map((position) => {
    const monthly = MONTHS.map((_, month) => monthFactAmountOnPosition(position, month, viewMode));
    const yearTotal = monthly.reduce((sum, value) => sum + value, 0);
    return row([
      planVersionId,
      planYear,
      position.positionId,
      position.role,
      position.department,
      position.unit,
      position.team,
      ...monthly,
      yearTotal,
    ]);
  });

  return UTF8_BOM + [header, ...lines].join("\r\n");
}

export function planExportFilename(kind: "plan" | "fact", planVersionId: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `fot-${kind}-${planVersionId}-${stamp}.csv`;
}

export function downloadCsvFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
