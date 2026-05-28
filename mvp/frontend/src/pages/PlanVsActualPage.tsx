import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useMvpApp } from "../context/MvpAppContext";
import {
  formatMoney,
  HAS_FACT_DATA,
  planFactByDepartment,
  planFactTotals,
  varianceTone,
} from "../data/planFactMetrics";
import { departmentOptions } from "../data/planningData";

export function PlanVsActualPage() {
  const { positions, viewMode, activePlan } = useMvpApp();
  const [department, setDepartment] = useState("All");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return positions.filter((position) => {
      if (department !== "All" && position.department !== department) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!`${position.department} ${position.unit} ${position.team}`.toLowerCase().includes(q)) return false;
      }
      return position.status !== "Closed";
    });
  }, [positions, department, search]);

  const totals = useMemo(() => planFactTotals(filtered, viewMode), [filtered, viewMode]);
  const rows = useMemo(() => planFactByDepartment(filtered, viewMode), [filtered, viewMode]);

  return (
    <div className="content-page plan-fact-page">
      <header className="page-header">
        <div>
          <h1>План и факт</h1>
          <p>
            {activePlan.label} · {viewMode === "total" ? "итого ФОТ" : "оклад"} · {totals.ytdLabel}
            {!HAS_FACT_DATA && " · факт ожидает импорт Excel"}
          </p>
        </div>
      </header>

      <section className="kpi-grid kpi-grid--compact">
        <article className="kpi-card">
          <span>План YTD</span>
          <strong>{formatMoney(totals.plan, true)}</strong>
        </article>
        <article className="kpi-card">
          <span>Факт YTD</span>
          <strong className="text-muted-strong">{HAS_FACT_DATA ? formatMoney(totals.fact, true) : "—"}</strong>
        </article>
        <article className="kpi-card">
          <span>Отклонение</span>
          <strong className={`variance-value variance-value--${varianceTone(totals.variance)}`}>
            {HAS_FACT_DATA ? formatMoney(totals.variance, true) : "—"}
          </strong>
        </article>
        <article className="kpi-card">
          <span>% отклонения</span>
          <strong className={`variance-value variance-value--${varianceTone(totals.variance)}`}>
            {HAS_FACT_DATA ? `${totals.variancePct.toFixed(1)}%` : "—"}
          </strong>
        </article>
      </section>

      <section className="card filters-card">
        <h2 className="section-title">Срезы</h2>
        <div className="filters-grid filters-grid--toolbar">
          <label>
            Департамент
            <select value={department} onChange={(event) => setDepartment(event.target.value)}>
              <option value="All">Все</option>
              {departmentOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="search-field">
            <Search size={14} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по оргструктуре…" />
          </label>
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">План / факт по департаментам</h2>
        <div className="table-scroll">
          <table className="simple-table simple-table--numeric">
            <thead>
              <tr>
                <th>Департамент</th>
                <th>План YTD</th>
                <th>Факт YTD</th>
                <th>Отклонение</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.label}</td>
                  <td>{formatMoney(row.plan)}</td>
                  <td className="text-muted-strong">{HAS_FACT_DATA ? formatMoney(row.fact) : "—"}</td>
                  <td className={`variance-value variance-value--${varianceTone(row.variance)}`}>
                    {HAS_FACT_DATA ? formatMoney(row.variance) : "—"}
                  </td>
                  <td className={`variance-value variance-value--${varianceTone(row.variance)}`}>
                    {HAS_FACT_DATA ? `${row.variancePct.toFixed(1)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <p className="muted-line">Нет данных по фильтру.</p>}
      </section>
    </div>
  );
}
