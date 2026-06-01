import {
  compareKpis,
  formatMln,
  monthlyCompareSeries,
  varianceByDepartment,
  varianceByLimit,
} from "../data/planVersionCompare";
import type { PositionRecord } from "../types";

type Props = {
  baselineLabel: string;
  draftLabel: string;
  baselinePositions: PositionRecord[];
  draftPositions: PositionRecord[];
};

export function VersionCompareDashboard({ baselineLabel, draftLabel, baselinePositions, draftPositions }: Props) {
  const kpis = compareKpis(baselinePositions, draftPositions);
  const monthly = monthlyCompareSeries(baselinePositions, draftPositions);
  const byLimit = varianceByLimit(baselinePositions, draftPositions);
  const byDept = varianceByDepartment(baselinePositions, draftPositions);
  const chartMax = Math.max(...monthly.map((point) => Math.max(point.baseline, point.draft)), 1);

  return (
    <div className="version-compare">
      <div className="version-compare__filters">
        <label>
          База
          <input type="text" readOnly value={baselineLabel} />
        </label>
        <label>
          Сравнение
          <input type="text" readOnly value={draftLabel} />
        </label>
        <span className="version-compare__filters-note">Режим: итого ФОТ (BASE + премия)</span>
      </div>

      <div className="version-compare__kpi">
        <article className="version-kpi version-kpi--plan">
          <span>План (база)</span>
          <strong>{formatMln(kpis.baselineAnnual)}</strong>
        </article>
        <article className="version-kpi version-kpi--plan-alt">
          <span>Черновик</span>
          <strong>{formatMln(kpis.draftAnnual)}</strong>
        </article>
        <article className="version-kpi version-kpi--variance">
          <span>Отклонение</span>
          <strong>{formatMln(kpis.variance)}</strong>
        </article>
        <article className="version-kpi version-kpi--variance">
          <span>Отклонение, %</span>
          <strong>{kpis.variancePct.toFixed(1)}%</strong>
        </article>
        <article className="version-kpi version-kpi--hc">
          <span>Численность</span>
          <strong>
            {kpis.baselineHeadcount} → {kpis.draftHeadcount}
          </strong>
        </article>
      </div>

      <div className="version-compare__charts">
        <section className="version-chart-card version-chart-card--wide">
          <h3>План vs черновик по месяцам</h3>
          <div className="version-month-chart">
            {monthly.map((point) => (
              <div key={point.month} className="version-month-chart__col">
                <div className="version-month-chart__bars">
                  <div
                    className="version-month-chart__bar version-month-chart__bar--base"
                    style={{ height: `${(point.baseline / chartMax) * 100}%` }}
                    title={`База: ${formatMln(point.baseline)}`}
                  />
                  <div
                    className="version-month-chart__bar version-month-chart__bar--draft"
                    style={{ height: `${(point.draft / chartMax) * 100}%` }}
                    title={`Черновик: ${formatMln(point.draft)}`}
                  />
                </div>
                <span>{point.label.slice(0, 3)}</span>
              </div>
            ))}
          </div>
          <div className="version-chart-legend">
            <span className="version-chart-legend__item version-chart-legend__item--base">База</span>
            <span className="version-chart-legend__item version-chart-legend__item--draft">Черновик</span>
          </div>
        </section>

        <section className="version-chart-card">
          <h3>Отклонение по лимиту</h3>
          <ul className="version-hbar-list">
            {byLimit.map((row) => (
              <li key={row.id}>
                <span>{row.label}</span>
                <div className="version-hbar">
                  <div
                    className={`version-hbar__fill${row.variance < 0 ? " version-hbar__fill--neg" : ""}`}
                    style={{ width: `${Math.min(100, (Math.abs(row.variance) / Math.max(Math.abs(kpis.variance), 1)) * 100)}%` }}
                  />
                </div>
                <strong>{formatMln(row.variance)}</strong>
              </li>
            ))}
          </ul>
        </section>

        <section className="version-chart-card">
          <h3>Отклонение по департаментам</h3>
          <ul className="version-hbar-list">
            {byDept.map((row) => (
              <li key={row.id}>
                <span>{row.label}</span>
                <div className="version-hbar">
                  <div
                    className="version-hbar__fill version-hbar__fill--dept"
                    style={{
                      width: `${Math.min(100, (Math.abs(row.variance) / Math.max(...byDept.map((item) => Math.abs(item.variance)), 1)) * 100)}%`,
                    }}
                  />
                </div>
                <strong>{formatMln(row.variance)}</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
