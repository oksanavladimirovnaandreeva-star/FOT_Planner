import { useMemo } from "react";
import { Link } from "react-router-dom";
import { VersionCompareDashboard } from "../VersionCompareDashboard";
import {
  buildCorrectionLimitImpact,
  formatLimitImpactSummary,
} from "../../data/planCorrectionCompare";
import type { CorrectionWindowInfo } from "../../data/planCorrectionWindow";
import { formatDiffSummaryLine } from "../../data/planVersionDiff";
import { LIMIT_FLAG_LABELS } from "../../data/planningData";
import { filterPositionsByRole } from "../../data/userAccess";
import { planWorkspaceBasePath, type PlanWorkspaceMode } from "../../data/planWorkspaceMode";
import { useMvpApp } from "../../context/MvpAppContext";
import { formatGrowthDelta } from "../../data/planningData";

type Props = {
  workspaceMode: PlanWorkspaceMode;
  correctionWindow?: CorrectionWindowInfo;
};

export function CorrectionComparePanel({ workspaceMode, correctionWindow }: Props) {
  const { versionDiff, workingDraft, userRole } = useMvpApp();
  const { rows, summary, baselinePositions, draftPositions } = versionDiff;

  const scopedBaseline = useMemo(
    () => filterPositionsByRole(baselinePositions, userRole),
    [baselinePositions, userRole],
  );
  const scopedDraft = useMemo(
    () => filterPositionsByRole(draftPositions, userRole),
    [draftPositions, userRole],
  );

  const limitImpact = useMemo(
    () => buildCorrectionLimitImpact(scopedBaseline, scopedDraft),
    [scopedBaseline, scopedDraft],
  );

  const journalBase = planWorkspaceBasePath(workspaceMode);
  const compareFromMonth =
    workspaceMode === "correction" && correctionWindow?.enforced
      ? correctionWindow.startMonth ?? undefined
      : undefined;

  if (!workingDraft || baselinePositions.length === 0) {
    return (
      <section className="card correction-compare-panel correction-compare-panel--empty">
        <h2 className="section-title">Сравнение с утверждённой базой</h2>
        <p className="muted-line">
          {workingDraft
            ? "Нет данных базовой версии для сравнения."
            : "Создайте квартальный черновик на «Версии», чтобы увидеть влияние правок на лимит и ФОТ."}
        </p>
        <Link className="secondary-btn" to="/versions">
          Версии бюджета
        </Link>
      </section>
    );
  }

  return (
    <div className="correction-compare-panel">
      <section className="card correction-compare-panel__summary">
        <h2 className="section-title">
          Сравнение · {summary.baselineLabel} → {summary.draftLabel}
        </h2>
        <p className="correction-compare-panel__diff-line">{formatDiffSummaryLine(summary)}</p>
        <p className="correction-compare-panel__limit-line">
          <strong>Влияние на лимит:</strong> {formatLimitImpactSummary(limitImpact)}
        </p>
        {compareFromMonth != null ? (
          <p className="muted-line">
            График помесячно: с {correctionWindow?.startMonthLabel} (окно корректировки). Годовые KPI — на весь план.
          </p>
        ) : null}
        {rows.length > 0 ? (
          <Link
            className="secondary-btn"
            to={`${journalBase}?tab=journal&diff=1&positions=${rows.map((row) => row.positionId).join(",")}`}
          >
            Журнал изменений ({rows.length} поз.)
          </Link>
        ) : null}
      </section>

      <section className="card correction-compare-panel__limit-table">
        <h3 className="subsection-title">Лимит: база vs черновик</h3>
        <div className="table-scroll">
          <table className="simple-table simple-table--numeric">
            <thead>
              <tr>
                <th>Признак</th>
                <th>Поз. база</th>
                <th>Поз. черновик</th>
                <th>Δ поз.</th>
                <th>ФОТ база</th>
                <th>ФОТ черновик</th>
                <th>Δ ФОТ год</th>
              </tr>
            </thead>
            <tbody>
              {limitImpact.byLimit.map((row) => (
                <tr key={row.limitFlag}>
                  <td>
                    <span className={`limit-flag-badge limit-flag-badge--${row.limitFlag}`}>{row.label}</span>
                  </td>
                  <td>{row.baselineHeadcount}</td>
                  <td>{row.draftHeadcount}</td>
                  <td className={row.headcountDelta > 0 ? "delta-cell--up" : row.headcountDelta < 0 ? "delta-cell--down" : ""}>
                    {row.headcountDelta > 0 ? "+" : ""}
                    {row.headcountDelta}
                  </td>
                  <td>{Math.round(row.baselineAnnualFot).toLocaleString("ru-RU")}</td>
                  <td>{Math.round(row.draftAnnualFot).toLocaleString("ru-RU")}</td>
                  <td className={row.fotDelta > 0 ? "delta-cell--up" : row.fotDelta < 0 ? "delta-cell--down" : ""}>
                    {formatGrowthDelta(row.fotDelta)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {limitImpact.newOverLimitPositions > 0 ? (
          <p className="correction-compare-panel__warn" role="status">
            Позиций сверх лимита (новые или смена признака): <strong>{limitImpact.newOverLimitPositions}</strong>
            — маршрут согласования может потребовать HR/C&B.
          </p>
        ) : null}
      </section>

      {limitImpact.limitFlagChanges.length > 0 ? (
        <section className="card correction-compare-panel__flag-changes">
          <h3 className="subsection-title">Смена признака лимита</h3>
          <div className="table-scroll">
            <table className="simple-table">
              <thead>
                <tr>
                  <th>Позиция</th>
                  <th>Было</th>
                  <th>Стало</th>
                  <th>Δ ФОТ год</th>
                </tr>
              </thead>
              <tbody>
                {limitImpact.limitFlagChanges.map((row) => (
                  <tr key={row.positionId}>
                    <td>
                      <strong>{row.positionId}</strong>
                      <div className="muted-line">{row.role}</div>
                    </td>
                    <td>
                      <span className={`limit-flag-badge limit-flag-badge--${row.baselineFlag}`}>
                        {LIMIT_FLAG_LABELS[row.baselineFlag]}
                      </span>
                    </td>
                    <td>
                      <span className={`limit-flag-badge limit-flag-badge--${row.draftFlag}`}>
                        {LIMIT_FLAG_LABELS[row.draftFlag]}
                      </span>
                    </td>
                    <td>{formatGrowthDelta(row.fotDelta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <VersionCompareDashboard
        baselineLabel={summary.baselineLabel}
        draftLabel={summary.draftLabel}
        baselinePositions={scopedBaseline}
        draftPositions={scopedDraft}
        compareFromMonth={compareFromMonth}
      />
    </div>
  );
}
