import { appendExportAuditLog, type ExportAuditFormat } from "./exportAuditLog";
import {
  buildOrgScopeHash,
  buildPlanFactCsv,
  buildPlanPositionsCsv,
  downloadCsvFile,
  formatOrgScopeLabel,
  planExportFilename,
} from "./exportPlanCsv";
import type { OrgSliceSelection } from "./orgSliceFilters";
import type { UserRole } from "./userAccess";
import type { PositionRecord } from "../types";
import type { ViewMode } from "./dashboardMetrics";

export type ScopedCsvExportKind = "plan" | "fact";

export function runScopedCsvExport(options: {
  kind: ScopedCsvExportKind;
  positions: PositionRecord[];
  viewMode: ViewMode;
  planVersionId: string;
  planYear: number;
  userRole: UserRole;
  scope: OrgSliceSelection;
}): { ok: true; rowCount: number } | { ok: false; error: string } {
  const { kind, positions, viewMode, planVersionId, planYear, userRole, scope } = options;
  if (positions.length === 0) {
    return { ok: false, error: "Нет позиций в текущем срезе для экспорта." };
  }

  const content =
    kind === "plan"
      ? buildPlanPositionsCsv({ positions, viewMode, planVersionId, planYear })
      : buildPlanFactCsv({ positions, viewMode, planVersionId, planYear });

  if (!content) {
    return { ok: false, error: "Факт не загружен — экспорт факта недоступен." };
  }

  downloadCsvFile(content, planExportFilename(kind, planVersionId));
  appendExportAuditLog({
    userRole,
    format: `${kind}_csv` as ExportAuditFormat,
    rowCount: positions.length,
    scopeHash: buildOrgScopeHash(scope),
    planVersionId,
    scopeLabel: formatOrgScopeLabel(scope),
  });

  return { ok: true, rowCount: positions.length };
}
