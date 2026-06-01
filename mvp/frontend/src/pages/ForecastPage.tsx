import { useMemo } from "react";
import { Link } from "react-router-dom";
import { forecastDecSnapshot, fullForecastTotals, naiveForecastTotals } from "../data/forecastMetrics";
import { formatGrowthDelta, formatGrowthPct } from "../data/planningData";
import { hasFactData } from "../data/factStore";
import { useMvpApp } from "../context/MvpAppContext";

function formatMoney(value: number): string {
  return `${Math.round(value).toLocaleString("ru-RU")} ₽`;
}

export function ForecastPage() {
  const { positions, viewMode, activePlan } = useMvpApp();
  const factReady = hasFactData();
  const throughMonth = new Date().getMonth();

  const totals = useMemo(
    () => fullForecastTotals(positions, viewMode, throughMonth),
    [positions, viewMode, throughMonth],
  );
  const legacyTotals = useMemo(
    () => naiveForecastTotals(positions, viewMode, throughMonth),
    [positions, viewMode, throughMonth],
  );
  const dec = useMemo(() => forecastDecSnapshot(positions), [positions]);

  return (
    <div className="content-page forecast-page">
      <header className="content-page__header">
        <div>
          <h1>Прогноз до конца года</h1>
          <p className="content-page__lead">
            {activePlan.label} · <strong>факт</strong> за прошедшие месяцы (если загружен) +{" "}
            <strong>план с событиями</strong> (индексация, переводы, увольнения) на оставшийся период.
          </p>
        </div>
      </header>

      {!factReady ? (
        <section className="card forecast-page__notice">
          <p>
            Факт не загружен — YTD считается по плану с событиями. Импортируйте JSON по <code>employee_id</code> в
            панели «Данные».
          </p>
          <p className="muted-text">Образец: <code>sample-fact.schema-v1.json</code> в папке frontend.</p>
        </section>
      ) : null}

      <section className="forecast-page__kpi-grid">
        <article className="mini-stat-card">
          <span>{factReady ? "Факт" : "План"} YTD · янв — {totals.throughLabel}</span>
          <strong>{formatMoney(totals.actualYtd)}</strong>
        </article>
        <article className="mini-stat-card">
          <span>План YTD (с событиями)</span>
          <strong>{formatMoney(totals.planYtd)}</strong>
          <div className="muted-text">{formatGrowthDelta(totals.varianceYtd)}</div>
        </article>
        <article className="mini-stat-card">
          <span>Прогноз на год</span>
          <strong>{formatMoney(totals.forecastYear)}</strong>
          <div className="muted-text">
            {factReady ? "факт YTD" : "план YTD"} + план с событиями до декабря
          </div>
        </article>
        <article className="mini-stat-card">
          <span>План на год (с событиями)</span>
          <strong>{formatMoney(totals.planYear)}</strong>
          {legacyTotals.forecastYear !== totals.forecastYear ? (
            <div className="muted-text">
              без событий: {formatMoney(legacyTotals.forecastYear)}
            </div>
          ) : null}
        </article>
      </section>

      <section className="card">
        <h2>Дек→дек по плану с событиями</h2>
        <div className="forecast-page__dec-grid">
          <div>
            <span className="muted-text">Итого</span>
            <strong>{dec.totalPctLabel}</strong>
            <div className="muted-text">
              {dec.total.decPrev.toLocaleString("ru-RU")} → {dec.total.decPlan.toLocaleString("ru-RU")} ₽
            </div>
          </div>
          <div>
            <span className="muted-text">В лимите</span>
            <strong>{formatGrowthPct(dec.inLimit.pct)}</strong>
          </div>
          <div>
            <span className="muted-text">Сверх лимита</span>
            <strong>{formatGrowthPct(dec.overLimit.pct)}</strong>
          </div>
        </div>
      </section>

      <section className="card forecast-page__roadmap">
        <h2>Дальше в продукте</h2>
        <ul>
          <li>Сверка с <Link to="/versions">версией бюджета</Link> и черновиком квартала.</li>
          <li>Загрузка факта из 1С (one-way) на API — после финализации UI.</li>
        </ul>
      </section>
    </div>
  );
}
