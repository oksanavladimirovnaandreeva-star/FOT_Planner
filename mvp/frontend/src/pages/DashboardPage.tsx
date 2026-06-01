import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnalyticsSummaryStrip } from "../components/AnalyticsSummaryStrip";
import { useMvpApp } from "../context/MvpAppContext";
import {
  DEFAULT_DASHBOARD_FILTERS,
  filterPositionsForDashboard,
  monthlyPlanFactByLimit,
  monthlyPlanFactSeries,
  planFactByLimitYear,
  sliceAnalytics,
  type DashboardFilters,
} from "../data/dashboardMetrics";
import { PlanByLimitDonut, PlanFactMonthlyChart } from "../components/PlanLimitCharts";
import { mapPositionsWithAppliedEvents } from "../data/planOperations";
import { departmentOptions, LIMIT_FLAG_LABELS, teamOptions, unitOptions } from "../data/planningData";
import type { LimitFlagKey } from "../types";
const DISPLAY_LIMIT_FLAGS: LimitFlagKey[] = ["IN_LIMIT", "OVER_LIMIT"];
function formatMoney(value: number): string {
  return `${Math.round(value).toLocaleString("ru-RU")}`;
}

export function DashboardPage() {
  const { positions, viewMode, activePlan, planVersionId, salaryBands } = useMvpApp();
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_DASHBOARD_FILTERS);

  const displayPositions = useMemo(() => mapPositionsWithAppliedEvents(positions), [positions]);
  const filtered = useMemo(
    () => filterPositionsForDashboard(displayPositions, filters),
    [displayPositions, filters],
  );
  const analytics = useMemo(() => sliceAnalytics(filtered, viewMode), [filtered, viewMode]);
  const monthlyPf = useMemo(() => monthlyPlanFactSeries(filtered, viewMode), [filtered, viewMode]);
  const monthlyByLimit = useMemo(() => monthlyPlanFactByLimit(filtered, viewMode), [filtered, viewMode]);
  const limitYear = useMemo(() => planFactByLimitYear(filtered, viewMode), [filtered, viewMode]);

  const updateFilter = <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "department") {
        const dept = value as string;
        if (dept === "All") {
          next.unit = "All";
          next.team = "All";
        } else {
          const units = unitOptions(dept);
          next.unit = units.includes(prev.unit) ? prev.unit : "All";
          if (next.unit === "All") next.team = "All";
          else {
            const teams = teamOptions(dept, next.unit);
            next.team = teams.includes(prev.team) ? prev.team : "All";
          }
        }
      }
      if (key === "unit") {
        const dept = next.department;
        const unit = value as string;
        if (unit === "All" || dept === "All") next.team = "All";
        else {
          const teams = teamOptions(dept, unit);
          next.team = teams.includes(prev.team) ? prev.team : "All";
        }
      }
      return next;
    });
  };

  return (
    <div className="content-page dashboard-page">
      <header className="page-header">
        <div>
          <h1>Обзор и итого</h1>
          <p>
            {activePlan.label} · {viewMode === "total" ? "итого ФОТ" : "оклад"} · план и факт (факт — заглушка до импорта)
          </p>
        </div>
        <Link className="primary-btn" to="/planning">
          Планирование
        </Link>
      </header>

      <section className="card filters-card">
        <h2 className="section-title">Срезы</h2>
        <div className="filters-grid">
          <label>
            Департамент
            <select value={filters.department} onChange={(e) => updateFilter("department", e.target.value)}>
              <option value="All">Все</option>
              {departmentOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            Юнит
            <select
              value={filters.unit}
              onChange={(e) => updateFilter("unit", e.target.value)}
              disabled={filters.department === "All"}
            >
              <option value="All">Все</option>
              {filters.department !== "All" &&
                unitOptions(filters.department).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Команда
            <select
              value={filters.team}
              onChange={(e) => updateFilter("team", e.target.value)}
              disabled={filters.department === "All" || filters.unit === "All"}
            >
              <option value="All">Все</option>
              {filters.department !== "All" &&
                filters.unit !== "All" &&
                teamOptions(filters.department, filters.unit).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Признак лимита
            <select value={filters.limitFlag} onChange={(e) => updateFilter("limitFlag", e.target.value as DashboardFilters["limitFlag"])}>
              <option value="All">Все</option>
              <option value="IN_LIMIT">{LIMIT_FLAG_LABELS.IN_LIMIT}</option>
              <option value="OVER_LIMIT">{LIMIT_FLAG_LABELS.OVER_LIMIT}</option>
            </select>
          </label>
          <label>
            Статус
            <select value={filters.status} onChange={(e) => updateFilter("status", e.target.value as DashboardFilters["status"])}>
              <option value="All">Все</option>
              <option value="Occupied">Занято</option>
              <option value="Vacancy">Вакансия</option>
              <option value="Closed">Закрыта</option>
            </select>
          </label>
        </div>
        <p className="muted-line">
          {planVersionId} · {filtered.length} поз. · {!analytics.hasFactData && "факт не загружен — колонки «Факт» пустые"}
        </p>
      </section>

      <AnalyticsSummaryStrip positions={filtered} viewMode={viewMode} salaryBands={salaryBands} showYtd />

      <section className="card dashboard-chart-card">
        <h2 className="section-title">План и факт</h2>
        <p className="muted-line">
          Слева — помесячные столбцы: план слоями по лимиту (в лимите / сверх), рядом столбец факта. Справа — доли
          плана за год без разбивки по месяцам.
        </p>
        <div className="chart-legend">
          <span>
            <i className="legend-swatch legend-swatch--in" /> В лимите (план)
          </span>
          <span>
            <i className="legend-swatch legend-swatch--over" /> Сверх лимита (план)
          </span>
          <span>
            <i className="legend-swatch legend-swatch--fact" /> Факт (итого)
          </span>
        </div>
        <div className="dashboard-charts-grid">
          <div className="dashboard-charts-grid__main">
            <PlanFactMonthlyChart monthlyByLimit={monthlyByLimit} hasFactData={analytics.hasFactData} />
          </div>
          <aside className="dashboard-charts-grid__side">
            <h3 className="subsection-title">План за год по лимиту</h3>
            <PlanByLimitDonut byLimit={limitYear} hasFactData={analytics.hasFactData} />
          </aside>
        </div>
      </section>

      <div className="dashboard-split">
          <section className="card">
            <h2 className="section-title">План / факт по месяцам (итого)</h2>
            <table className="month-table">
              <thead>
                <tr>
                  <th>Месяц</th>
                  <th>План</th>
                  <th>Факт</th>
                  <th>Δ</th>
                </tr>
              </thead>
              <tbody>
                {monthlyPf.map((row) => (
                  <tr key={row.month}>
                    <td>{row.label}</td>
                    <td>{formatMoney(row.plan)}</td>
                    <td className="text-muted-strong">—</td>
                    <td className="text-muted-strong">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="card">
            <h2 className="section-title">План-факт и отклонение по лимиту (год)</h2>
            <table className="simple-table">
              <thead>
                <tr>
                  <th>Лимит</th>
                  <th>План</th>
                  <th>Факт</th>
                  <th>Δ</th>
                </tr>
              </thead>
              <tbody>
                {DISPLAY_LIMIT_FLAGS.map((flag) => {
                  const cell = limitYear[flag];
                  return (
                    <tr key={flag}>
                      <td>
                        <span className={`limit-flag-badge limit-flag-badge--${flag}`}>{LIMIT_FLAG_LABELS[flag]}</span>
                      </td>
                      <td>{formatMoney(cell.plan)}</td>
                      <td className="text-muted-strong">—</td>
                      <td className="text-muted-strong">—</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </div>
    </div>
  );
}
