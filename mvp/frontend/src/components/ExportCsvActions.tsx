import { hasFactData } from "../data/factStore";
import { runScopedCsvExport, type ScopedCsvExportKind } from "../data/exportScopedCsv";
import type { OrgSliceSelection } from "../data/orgSliceFilters";
import type { UserRole } from "../data/userAccess";
import type { PositionRecord } from "../types";
import type { ViewMode } from "../data/dashboardMetrics";

type Props = {
  positions: PositionRecord[];
  viewMode: ViewMode;
  planVersionId: string;
  planYear: number;
  userRole: UserRole;
  scope: OrgSliceSelection;
  compact?: boolean;
};

export function ExportCsvActions({
  positions,
  viewMode,
  planVersionId,
  planYear,
  userRole,
  scope,
  compact = false,
}: Props) {
  const factReady = hasFactData();

  const handleExport = (kind: ScopedCsvExportKind) => {
    const result = runScopedCsvExport({
      kind,
      positions,
      viewMode,
      planVersionId,
      planYear,
      userRole,
      scope,
    });
    if (!result.ok) window.alert(result.error);
  };

  return (
    <div className={`export-csv-actions${compact ? " export-csv-actions--compact" : ""}`}>
      <button type="button" className="secondary-btn" onClick={() => handleExport("plan")} title="CSV плана в видимом срезе">
        {compact ? "CSV план" : "Экспорт плана CSV"}
      </button>
      <button
        type="button"
        className="secondary-btn"
        onClick={() => handleExport("fact")}
        disabled={!factReady}
        title={factReady ? "CSV факта в видимом срезе" : "Сначала загрузите факт в «Данные»"}
      >
        {compact ? "CSV факт" : "Экспорт факта CSV"}
      </button>
    </div>
  );
}
