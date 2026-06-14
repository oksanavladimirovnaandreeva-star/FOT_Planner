import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { PlanFactBaselineBanner } from "../components/PlanFactBaselineBanner";
import { useMvpApp } from "../context/MvpAppContext";
import { mapPositionsWithAppliedEvents } from "../data/planOperations";
import {
  formatMoney,
  hasPlanFactData,
  planFactByLimit,
  planFactEconomyAndOverspendTotals,
  planFactPositionRows,
  planFactTotals,
  varianceTone,
} from "../data/planFactMetrics";
import {
  collectPlanFactVarianceDrivers,
  summarizeVarianceDrivers,
} from "../data/planFactVarianceDrivers";

export function DeviationPage({ embedded = false }: { embedded?: boolean }) {
  const { planFactBaseline: baseline, viewMode } = useMvpApp();

  const factReady = hasPlanFactData();
  const active = useMemo(
    () => mapPositionsWithAppliedEvents(baseline.positions).filter((position) => position.status !== "Closed"),
    [baseline.positions],
  );
  const totals = useMemo(() => planFactTotals(active, viewMode), [active, viewMode]);
  const byLimit = useMemo(() => planFactByLimit(active, viewMode), [active, viewMode]);
  const economyTotals = useMemo(() => planFactEconomyAndOverspendTotals(active, viewMode), [active, viewMode]);
  const topPositions = useMemo(() => planFactPositionRows(active, viewMode).slice(0, 8), [active, viewMode]);
  const driverCases = useMemo(() => collectPlanFactVarianceDrivers(active, viewMode), [active, viewMode]);
  const driverSummary = useMemo(() => summarizeVarianceDrivers(driverCases), [driverCases]);
  const topDriverCases = useMemo(() => driverCases.slice(0, 12), [driverCases]);

  const economyByLimit = byLimit.filter((row) => row.variance > 0).sort((a, b) => b.variance - a.variance);
  const overspendByLimit = byLimit.filter((row) => row.variance < 0).sort((a, b) => a.variance - b.variance);

  const chartMax = useMemo(() => {
    let max = 1;
    for (const row of byLimit) {
      max = Math.max(max, Math.abs(row.variance), row.plan);
    }
    return max;
  }, [byLimit]);

  const body = (
    <>
      <PlanFactBaselineBanner baseline={baseline} />

      <div className="plan-fact-readonly-note" role="note">
        Всегда <strong>план − факт</strong>: плюс — экономия, минус — перерасход. Факт не меняет план.
      </div>

      <div className="deviation-alerts">
        <section className="card deviation-alert deviation-alert--under">
          <div className="deviation-alert__head">
            <ArrowDownRight size={18} />
            <h2 className="section-title">Экономия (план − факт &gt; 0)</h2>
          </div>
          {!factReady ? (
            <p className="muted-line">Загрузите факт, чтобы увидеть экономию.</p>
          ) : (
            <p className="deviation-alert__total variance-value variance-value--under">
              Итого: {formatMoney(economyTotals.economy, true)}
            </p>
          )}
        </section>

        <section className="card deviation-alert deviation-alert--over">
          <div className="deviation-alert__head">
            <ArrowUpRight size={18} />
            <h2 className="section-title">Перерасход (план − факт &lt; 0)</h2>
          </div>
          {!factReady ? (
            <p className="muted-line">Загрузите факт для расчёта перерасхода.</p>
          ) : (
            <p className="deviation-alert__total variance-value variance-value--over">
              Итого: {formatMoney(economyTotals.overspend, true)}
            </p>
          )}
        </section>
      </div>

      {factReady && driverSummary.length > 0 ? (
        <section className="card">
          <h2 className="section-title">Почему отклонение</h2>
          <p className="muted-line">
            Разбор YTD по сценариям: вакансии, найм дешевле/дороже, занятость. Только аналитика — не задачи на
            корректировку.
          </p>
          <div className="table-scroll">
            <table className="simple-table simple-table--numeric">
              <thead>
                <tr>
                  <th>Причина</th>
                  <th>Случаев</th>
                  <th>Экономия</th>
                  <th>Перерасход</th>
                  <th>Нетто (план − факт)</th>
                </tr>
              </thead>
              <tbody>
                {driverSummary.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.label}</strong>
                      <div className="muted-line">{row.hint}</div>
                    </td>
                    <td>{row.caseCount}</td>
                    <td className="variance-value variance-value--under">
                      {row.economy > 0 ? formatMoney(row.economy) : "—"}
                    </td>
                    <td className="variance-value variance-value--over">
                      {row.overspend > 0 ? formatMoney(row.overspend) : "—"}
                    </td>
                    <td className={`variance-value variance-value--${varianceTone(row.netDelta)}`}>
                      {formatMoney(row.netDelta)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {factReady && topDriverCases.length > 0 ? (
        <section className="card">
          <h2 className="section-title">Примеры по позициям и месяцам</h2>
          <div className="table-scroll">
            <table className="simple-table simple-table--numeric">
              <thead>
                <tr>
                  <th>Причина</th>
                  <th>Позиция</th>
                  <th>Месяц</th>
                  <th>План</th>
                  <th>Факт</th>
                  <th>План − факт</th>
                </tr>
              </thead>
              <tbody>
                {topDriverCases.map((item, index) => (
                  <tr key={`${item.positionId}-${item.month}-${index}`}>
                    <td className="muted-line">{driverSummary.find((d) => d.id === item.driverId)?.label ?? item.driverId}</td>
                    <td>
                      <Link to={`/planning?position=${item.positionId}`}>{item.positionId}</Link>
                      <div className="muted-line">{item.role}</div>
                    </td>
                    <td>{item.monthLabel}</td>
                    <td>{formatMoney(item.planAmount)}</td>
                    <td className="text-muted-strong">{formatMoney(item.factAmount)}</td>
                    <td className={`variance-value variance-value--${varianceTone(item.delta)}`}>
                      {formatMoney(item.delta)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="card">
        <h2 className="section-title">План − факт по признаку лимита (YTD)</h2>
        <div className="deviation-chart">
          {byLimit.map((row) => {
            const height = Math.max(4, (Math.abs(row.variance || row.plan) / chartMax) * 100);
            const tone = varianceTone(row.variance);
            return (
              <div key={row.id} className="deviation-chart__item">
                <div className="deviation-chart__bar-wrap">
                  <div
                    className={`deviation-chart__bar deviation-chart__bar--${tone}`}
                    style={{ height: `${height}%` }}
                    title={`${row.label}: ${formatMoney(row.variance, true)}`}
                  />
                </div>
                <span className="deviation-chart__label">{row.label}</span>
                <span className="muted-line">{factReady ? formatMoney(row.variance, true) : formatMoney(row.plan, true)}</span>
              </div>
            );
          })}
        </div>
        {factReady ? (
          <div className="deviation-limit-split">
            {economyByLimit.length > 0 ? (
              <p className="muted-line">
                Экономия: {economyByLimit.map((row) => `${row.label} ${formatMoney(row.variance, true)}`).join(" · ")}
              </p>
            ) : null}
            {overspendByLimit.length > 0 ? (
              <p className="muted-line">
                Перерасход:{" "}
                {overspendByLimit.map((row) => `${row.label} ${formatMoney(Math.abs(row.variance), true)}`).join(" · ")}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      {factReady ? (
        <section className="card">
          <h2 className="section-title">Топ позиций по |план − факт|</h2>
          <div className="table-scroll">
            <table className="simple-table simple-table--numeric">
              <thead>
                <tr>
                  <th>Позиция</th>
                  <th>План YTD</th>
                  <th>Факт YTD</th>
                  <th>План − факт</th>
                </tr>
              </thead>
              <tbody>
                {topPositions.map((row) => (
                  <tr key={row.positionId}>
                    <td>
                      <Link to={`/planning?position=${row.positionId}`}>{row.positionId}</Link>
                      <div className="muted-line">{row.role}</div>
                    </td>
                    <td>{formatMoney(row.planYtd)}</td>
                    <td className="text-muted-strong">{formatMoney(row.factYtd)}</td>
                    <td className={`variance-value variance-value--${varianceTone(row.delta)}`}>
                      {formatMoney(row.delta)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="card">
        <h2 className="section-title">Что делать дальше</h2>
        <ul className="deviation-actions">
          <li>
            Занятость и «двое на стуле» — вкладка{" "}
            <Link to="/analytics?tab=plan-fact">План и факт</Link>.
          </li>
          <li>Экономия в отчёте — не триггер автокорректировки.</li>
          <li>
            Квартальные правки — <Link to="/planning?mode=correction">Корректировка</Link>, вручную.
          </li>
        </ul>
      </section>
    </>
  );

  if (embedded) return body;

  return (
    <div className="content-page deviation-page">
      <header className="page-header">
        <div>
          <h1>Отклонения</h1>
          <p>
            План − факт · {totals.ytdLabel}
            {factReady ? ` · нетто ${formatMoney(totals.variance, true)}` : " · факт не загружен"}
          </p>
        </div>
      </header>
      {body}
    </div>
  );
}
