import { useMemo } from "react";
import { AlertCircle, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { PlanFactBaselineBanner } from "../components/PlanFactBaselineBanner";
import { useMvpApp } from "../context/MvpAppContext";
import { mapPositionsWithAppliedEvents } from "../data/planOperations";
import {
  deviationDrivers,
  formatMoney,
  hasPlanFactData,
  planFactByLimit,
  planFactTotals,
  varianceTone,
} from "../data/planFactMetrics";

export function DeviationPage() {
  const { planFactBaseline: baseline, viewMode } = useMvpApp();

  const factReady = hasPlanFactData();
  const active = useMemo(
    () => mapPositionsWithAppliedEvents(baseline.positions).filter((position) => position.status !== "Closed"),
    [baseline.positions],
  );
  const totals = useMemo(() => planFactTotals(active, viewMode), [active, viewMode]);
  const byLimit = useMemo(() => planFactByLimit(active, viewMode), [active, viewMode]);
  const drivers = useMemo(() => deviationDrivers(byLimit), [byLimit]);

  const overages = drivers.filter((row) => row.variance < 0);
  const savings = drivers.filter((row) => row.variance > 0);

  const chartMax = useMemo(() => {
    let max = 1;
    for (const row of byLimit) {
      max = Math.max(max, Math.abs(row.variance), row.plan);
    }
    return max;
  }, [byLimit]);

  return (
    <div className="content-page deviation-page">
      <header className="page-header">
        <div>
          <h1>Отклонения</h1>
          <p>
            Анализ драйверов · {totals.ytdLabel}
            {!factReady && " · факт не загружен"}
          </p>
        </div>
      </header>

      <PlanFactBaselineBanner baseline={baseline} />

      <div className="deviation-alerts">
        <section className="card deviation-alert deviation-alert--over">
          <div className="deviation-alert__head">
            <AlertCircle size={18} />
            <h2 className="section-title">Перерасход (план выше факта)</h2>
          </div>
          {overages.length === 0 ? (
            <p className="muted-line">Нет строк с перерасходом по текущим данным.</p>
          ) : (
            <ul className="deviation-alert__list">
              {overages.slice(0, 3).map((row) => (
                <li key={row.id}>
                  <span>{row.label}</span>
                  <span className="variance-value variance-value--over">
                    <ArrowUpRight size={14} />
                    {factReady ? formatMoney(Math.abs(row.variance)) : "ожидает факт"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card deviation-alert deviation-alert--under">
          <div className="deviation-alert__head">
            <AlertCircle size={18} />
            <h2 className="section-title">Экономия (факт ниже плана)</h2>
          </div>
          {savings.length === 0 ? (
            <p className="muted-line">Нет строк с экономией — факт не импортирован.</p>
          ) : (
            <ul className="deviation-alert__list">
              {savings.slice(0, 3).map((row) => (
                <li key={row.id}>
                  <span>{row.label}</span>
                  <span className="variance-value variance-value--under">
                    <ArrowDownRight size={14} />
                    {formatMoney(row.variance)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card">
        <h2 className="section-title">Отклонение по признаку лимита (YTD план)</h2>
        <p className="muted-line">Положительный столбец — запас к плану, отрицательный — недобор факта (когда появится импорт).</p>
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
                    title={row.label}
                  />
                </div>
                <span className="deviation-chart__label">{row.label}</span>
                <span className="muted-line">{formatMoney(row.plan, true)}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">Рекомендуемые действия</h2>
        <ul className="deviation-actions">
          <li>Импортировать факт за месяц из Excel — тогда карточки и таблица на «План и факт» заполнятся автоматически.</li>
          <li>Сверить позиции OVER_LIMIT с планом найма: новые слоты по умолчанию вне лимита.</li>
          <li>После импорта пересмотреть департаменты с наибольшим |отклонением| на этой странице.</li>
        </ul>
      </section>
    </div>
  );
}
