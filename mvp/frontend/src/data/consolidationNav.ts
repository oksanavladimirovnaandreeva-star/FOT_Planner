import { planWorkspacePath } from "./planWorkspaceMode";
import type { TeamConsolidationRow } from "./teamConsolidation";

/** Ссылка на корректировку с фильтром команды; при событиях — журнал diff. */
export function teamCorrectionHref(row: Pick<TeamConsolidationRow, "department" | "unit" | "team" | "deltaPositionIds">): string {
  const params: Record<string, string> = {
    sliceDept: row.department,
    sliceUnit: row.unit,
    sliceTeam: row.team,
  };
  if (row.deltaPositionIds.length > 0) {
    params.tab = "journal";
    params.positions = row.deltaPositionIds.join(",");
    params.diff = "1";
  }
  return planWorkspacePath("correction", params);
}

/** Корректировка по юниту (все команды). */
export function unitCorrectionHref(department: string, unit: string): string {
  return planWorkspacePath("correction", {
    sliceDept: department,
    sliceUnit: unit,
  });
}
