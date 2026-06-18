import { useMemo } from "react";
import { Link } from "react-router-dom";
import { VersionCompareDashboard } from "../VersionCompareDashboard";
import {
  buildCorrectionLimitImpact,
  buildLimitDecGrowthComparison,
  formatLimitDecGrowthCell,
} from "../../data/planCorrectionCompare";
import type { CorrectionWindowInfo } from "../../data/planCorrectionWindow";
import { LIMIT_FLAG_LABELS } from "../../data/planningData";
import { filterPositionsByRole } from "../../data/userAccess";
import { formatGrowthDelta } from "../../data/planningData";
import { useMvpApp } from "../../context/MvpAppContext";

type Props = {
  correctionWindow?: CorrectionWindowInfo;
};

export function CorrectionComparePanel({ correctionWindow }: Props) {
  const { versionDiff, workingDraft, userRole } = useMvpApp();
  const { baselinePositions, draftPositions } = versionDiff;

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

  const limitDecGrowth = useMemo(
    () => buildLimitDecGrowthComparison(scopedBaseline, scopedDraft),
    [scopedBaseline, scopedDraft],
  );

  const compareFromMonth =
    correctionWindow?.enforced ? correctionWindow.startMonth ?? undefined : undefined;

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
      <section className="card correction-compare-panel__limit-table">
        <h2 className="section-title">Лимит: рост к декабрю</h2>
        <p className="muted-line correction-compare-panel__limit-note">
          Дек→дек по признакам «В лимите» и «Сверх лимита» — база vs черновик.
        </p>
        <div className="table-scroll">
          <table className="simple-table simple-table--numeric">
            <thead>
              <tr>
                <th>Признак</th>
                <th>База</th>
                <th>Черновик</th>
                <th>Δ п.п.</th>
                <th>Поз.</th>
              </tr>
            </thead>
            <tbody>
              {limitDecGrowth.map((row) => (
                <tr key={row.limitFlag}>
                  <td>
                    <span className={`limit-flag-badge limit-flag-badge--${row.limitFlag}`}>{row.label}</span>
                  </td>
                  <td>{formatLimitDecGrowthCell(row.baselineDecPrev, row.baselineDecPlan, row.baselinePct)}</td>
                  <td>{formatLimitDecGrowthCell(row.draftDecPrev, row.draftDecPlan, row.draftPct)}</td>
                  <td className={row.deltaPp > 0 ? "delta-cell--up" : row.deltaPp < 0 ? "delta-cell--down" : ""}>
                    {row.deltaPp >= 0 ? "+" : ""}
                    {row.deltaPp.toFixed(1)} п.п.
                  </td>
                  <td>{row.positionCount}</td>
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
        baselineLabel={versionDiff.summary.baselineLabel}
        draftLabel={versionDiff.summary.draftLabel}
        baselinePositions={scopedBaseline}
        draftPositions={scopedDraft}
        compareFromMonth={compareFromMonth}
      />
    </div>
  );
}
